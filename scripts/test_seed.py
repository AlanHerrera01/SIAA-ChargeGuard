import copy
import io
import json
from dataclasses import replace
from decimal import Decimal
from unittest.mock import MagicMock
from urllib.error import URLError

import pytest
from botocore.exceptions import ClientError

import demo_reset
import seed_local as seed


@pytest.fixture
def settings():
    return seed.Settings(
        seed.LOCAL_ENDPOINT, "us-east-1", "chargeguard-evidence", seed.ROOT / "datasets"
    )


def test_contract_schema_exact():
    expected = {
        "chargeguard-transactions": (
            [("user_id", "HASH"), ("sk", "RANGE")],
            {"merchant-index": [("merchant_id", "HASH"), ("sk", "RANGE")]},
        ),
        "chargeguard-cases": (
            [("case_id", "HASH")],
            {
                "user-index": [("user_id", "HASH"), ("created_at", "RANGE")],
                "status-index": [("status", "HASH"), ("created_at", "RANGE")],
            },
        ),
        "chargeguard-decisions": (
            [("decision_id", "HASH")],
            {
                "case-index": [("case_id", "HASH"), ("created_at", "RANGE")],
                "pending-index": [("status", "HASH"), ("created_at", "RANGE")],
            },
        ),
    }
    assert {d["TableName"] for d in seed.TABLES} == set(expected)
    for definition in seed.TABLES:
        keys, indexes = expected[definition["TableName"]]

        def extract(schema):
            return [(k["AttributeName"], k["KeyType"]) for k in schema]

        assert extract(definition["KeySchema"]) == keys
        assert {
            g["IndexName"]: extract(g["KeySchema"])
            for g in definition["GlobalSecondaryIndexes"]
        } == indexes
        assert definition["BillingMode"] == "PAY_PER_REQUEST"
        assert definition["DeletionProtectionEnabled"] is False
        assert all(
            a["AttributeType"] == "S" for a in definition["AttributeDefinitions"]
        )
        assert all(
            g["Projection"] == {"ProjectionType": "ALL"}
            for g in definition["GlobalSecondaryIndexes"]
        )


def test_settings_env_empty_is_not_default(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "AWS_ENDPOINT_URL=http://localhost:4566\nS3_BUCKET_EVIDENCE=from-file\nDATASET_DIR=datasets\n"
    )
    monkeypatch.delenv("AWS_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("S3_BUCKET_EVIDENCE", raising=False)
    monkeypatch.delenv("DATASET_DIR", raising=False)
    assert seed.Settings.from_env(env_file).endpoint == seed.LOCAL_ENDPOINT
    assert seed.Settings.from_env(env_file).bucket == "from-file"
    monkeypatch.setenv("AWS_ENDPOINT_URL", "")
    assert seed.Settings.from_env(env_file).endpoint is None
    monkeypatch.delenv("AWS_ENDPOINT_URL")
    env_file.write_text("AWS_ENDPOINT_URL=\n")
    assert seed.Settings.from_env(env_file).endpoint is None
    assert seed.Settings.from_env(tmp_path / "absent").endpoint == seed.LOCAL_ENDPOINT


@pytest.mark.parametrize("endpoint", [None, "https://dynamodb.us-west-2.amazonaws.com"])
def test_real_aws_client_options_without_network(settings, monkeypatch, endpoint):
    factory = MagicMock()
    monkeypatch.setattr(seed.boto3, "Session", factory)
    seed.connect(
        replace(settings, endpoint=endpoint, profile="team-demo", region="us-west-2")
    )
    factory.assert_called_once_with(region_name="us-west-2", profile_name="team-demo")
    for call in [
        factory.return_value.resource.call_args,
        factory.return_value.client.call_args,
    ]:
        options = call.kwargs
        assert ("endpoint_url" in options) == bool(endpoint)
        if endpoint:
            assert options["endpoint_url"] == endpoint
        assert options["config"].ignore_configured_endpoint_urls is True
        assert "aws_access_key_id" not in options


def test_local_ignores_real_profile(settings, monkeypatch):
    monkeypatch.setenv("AWS_PROFILE", "profile-that-does-not-exist")
    services = seed.connect(settings)
    assert services.dynamodb.meta.client.meta.endpoint_url == seed.LOCAL_ENDPOINT
    assert services.s3.meta.endpoint_url == seed.LOCAL_ENDPOINT
    services.dynamodb.meta.client.close()
    services.s3.close()


def test_dataset_decimal_keys_and_only_evidence(settings):
    items, objects = seed.load_dataset(settings.dataset_dir)
    source = json.loads((settings.dataset_dir / "transactions.json").read_text())
    assert len(items) == len(source) == 37
    assert len(objects) == 58
    for item in items:
        assert item["sk"] == f"{item['posted_at']}#{item['transaction_id']}"
        assert isinstance(item["amount_usd"], Decimal)
    assert all(
        key.startswith(("invoices/", "emails/", "terms/")) for _, key, _ in objects
    )
    assert {content for _, _, content in objects} == {
        "application/pdf",
        "message/rfc822",
    }


def client_error(code):
    return ClientError(
        {"Error": {"Code": code, "Message": "Synthetic test error"}}, "TestOperation"
    )


@pytest.mark.parametrize("region", ["us-east-1", "us-west-2"])
def test_bucket_region_security_and_idempotence(settings, region):
    s3 = MagicMock()
    s3.head_bucket.side_effect = [client_error("404"), {}]
    s3.get_bucket_versioning.return_value = {}
    s3.get_bucket_lifecycle_configuration.return_value = {
        "Rules": [
            {"Status": "Enabled", "Filter": {"Prefix": ""}, "Expiration": {"Days": 30}}
        ]
    }
    services = seed.Services(None, s3)
    configured = replace(settings, region=region)
    assert seed.ensure_bucket(services, configured) is True
    args = s3.create_bucket.call_args.kwargs
    assert args["Bucket"] == settings.bucket
    assert args.get("CreateBucketConfiguration") == (
        None if region == "us-east-1" else {"LocationConstraint": region}
    )
    assert all(
        s3.put_public_access_block.call_args.kwargs[
            "PublicAccessBlockConfiguration"
        ].values()
    )
    rules = s3.put_bucket_encryption.call_args.kwargs[
        "ServerSideEncryptionConfiguration"
    ]["Rules"]
    assert rules[0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"] == "AES256"
    assert seed.ensure_bucket(services, configured) is False
    assert s3.create_bucket.call_count == 1
    # Reusing a bucket must not overwrite existing lifecycle rules.
    assert s3.put_bucket_lifecycle_configuration.call_count == 1


def test_existing_bucket_denied_is_not_created(settings):
    s3 = MagicMock()
    s3.head_bucket.side_effect = client_error("403")
    with pytest.raises(ClientError):
        seed.ensure_bucket(seed.Services(None, s3), settings)
    s3.create_bucket.assert_not_called()


def test_versioned_bucket_refused(settings):
    s3 = MagicMock()
    s3.get_bucket_versioning.return_value = {"Status": "Enabled"}
    with pytest.raises(ValueError, match="versioning"):
        seed.ensure_bucket(seed.Services(None, s3), settings)
    s3.put_bucket_encryption.assert_not_called()


def test_existing_bucket_missing_expiry_refused(settings):
    s3 = MagicMock()
    s3.get_bucket_versioning.return_value = {}
    s3.get_bucket_lifecycle_configuration.side_effect = client_error(
        "NoSuchLifecycleConfiguration"
    )
    with pytest.raises(ValueError, match="30-day lifecycle"):
        seed.ensure_bucket(seed.Services(None, s3), settings)
    s3.put_bucket_lifecycle_configuration.assert_not_called()


def test_seed_batch_writer_and_deterministic_uploads(settings, monkeypatch):
    services = seed.Services(MagicMock(), MagicMock())
    monkeypatch.setattr(
        seed, "ensure_tables", lambda _: ([], [d["TableName"] for d in seed.TABLES])
    )
    monkeypatch.setattr(seed, "ensure_bucket", lambda *_: False)
    result = seed.seed(settings, services)
    table = services.dynamodb.Table.return_value
    table.batch_writer.assert_called_once_with(overwrite_by_pkeys=["user_id", "sk"])
    assert (
        table.batch_writer.return_value.__enter__.return_value.put_item.call_count == 37
    )
    assert result["items_loaded"] == 37 and result["objects_uploaded"] == 58
    assert services.s3.put_object.call_count == 58
    assert len({c.kwargs["Key"] for c in services.s3.put_object.call_args_list}) == 58


@pytest.mark.parametrize("problem", ["keys", "index", "billing", "protection"])
def test_incompatible_table_refused(problem):
    definition = seed.TABLES[0]
    actual = copy.deepcopy(definition)
    actual["BillingModeSummary"] = {"BillingMode": "PAY_PER_REQUEST"}
    seed.check_table(actual, definition)
    if problem == "keys":
        actual["KeySchema"][0]["AttributeName"] = "wrong"
    elif problem == "index":
        actual["GlobalSecondaryIndexes"] = []
    elif problem == "billing":
        actual["BillingModeSummary"]["BillingMode"] = "PROVISIONED"
    else:
        actual["DeletionProtectionEnabled"] = True
    with pytest.raises(ValueError, match="contract"):
        seed.check_table(actual, definition)


@pytest.mark.parametrize(
    "endpoint",
    [
        None,
        "https://dynamodb.us-east-1.amazonaws.com",
        "http://localhost:9000",
        "http://localhost.attacker.example:4566",
    ],
)
def test_reset_refuses_nonlocal_before_any_io(settings, endpoint):
    services = MagicMock()
    with pytest.raises(ValueError, match="only deletes"):
        demo_reset.reset(replace(settings, endpoint=endpoint), services)
    assert services.mock_calls == []


def test_reset_missing_data_preserves_tables(settings, tmp_path):
    services = MagicMock()
    with pytest.raises(OSError):
        demo_reset.reset(replace(settings, dataset_dir=tmp_path), services)
    assert services.mock_calls == []


def response():
    body = io.BytesIO(b'{"status":"ok"}')
    body.status = 200
    return body


@pytest.mark.parametrize("failed", [None, "bank", "merchant"])
def test_reset_calls_both_mocks_even_on_failure(settings, failed):
    opener = MagicMock()
    opener.open.side_effect = [
        URLError("down") if name == failed else response()
        for name in ("bank", "merchant")
    ]
    if failed:
        with pytest.raises(ValueError, match="One or more mocks"):
            demo_reset.reset_mocks(settings, opener)
    else:
        assert demo_reset.reset_mocks(settings, opener) == {
            "bank": "ok",
            "merchant": "ok",
        }
    assert [c.args[0].full_url for c in opener.open.call_args_list] == [
        "http://localhost:8001/demo/reset",
        "http://localhost:8002/demo/reset",
    ]
    assert all(
        c.args[0].get_method() == "POST" and c.kwargs["timeout"] == 3
        for c in opener.open.call_args_list
    )


def test_reset_deletes_only_three_named_tables_and_reseeds(settings, monkeypatch):
    services = seed.Services(MagicMock(), MagicMock())
    reseed = MagicMock(return_value={"items_loaded": 37})
    monkeypatch.setattr(demo_reset, "seed", reseed)
    mocks = MagicMock()
    monkeypatch.setattr(demo_reset, "reset_mocks", mocks)
    demo_reset.reset(settings, services)
    assert [
        c.kwargs["TableName"]
        for c in services.dynamodb.meta.client.delete_table.call_args_list
    ] == ["chargeguard-transactions", "chargeguard-cases", "chargeguard-decisions"]
    reseed.assert_called_once()
    mocks.assert_called_once()
    services.s3.delete_bucket.assert_not_called()


@pytest.mark.localstack
def test_seed_live_count_objects_indexes_and_idempotence():
    settings = seed.Settings.from_env()
    assert settings.local, "Integration writes must never target AWS real"
    services = seed.connect(settings)
    items, objects = seed.load_dataset(settings.dataset_dir)
    snapshots = []
    for _ in range(2):
        seed.seed(settings, services)
        table = services.dynamodb.Table("chargeguard-transactions")
        actual = []
        options = {"ConsistentRead": True}
        while True:
            page = table.scan(**options)
            actual.extend(page["Items"])
            if not page.get("LastEvaluatedKey"):
                break
            options["ExclusiveStartKey"] = page["LastEvaluatedKey"]
        assert len(actual) == len(items)
        assert sorted(actual, key=lambda t: t["sk"]) == sorted(
            items, key=lambda t: t["sk"]
        )
        keys = {
            obj["Key"]
            for page in services.s3.get_paginator("list_objects_v2").paginate(
                Bucket=settings.bucket
            )
            for obj in page.get("Contents", [])
        }
        assert {key for _, key, _ in objects} <= keys
        assert "ground_truth.json" not in keys
        snapshots.append((actual, keys))
        for definition in seed.TABLES:
            description = services.dynamodb.meta.client.describe_table(
                TableName=definition["TableName"]
            )["Table"]
            seed.check_table(description, definition)
            assert all(
                g["IndexStatus"] == "ACTIVE"
                for g in description["GlobalSecondaryIndexes"]
            )
    assert snapshots[0] == snapshots[1]

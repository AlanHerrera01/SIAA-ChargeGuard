"""Provision and seed the storage contract, locally or with the AWS credential chain."""

import json
import os
import sys
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

import boto3
import botocore.session
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
LOCAL_ENDPOINT = "http://localhost:4566"


@dataclass(frozen=True)
class Settings:
    endpoint: str | None
    region: str
    bucket: str
    dataset_dir: Path
    profile: str | None = None
    bank_url: str = "http://localhost:8001"
    merchant_url: str = "http://localhost:8002"

    @classmethod
    def from_env(cls, env_file: Path = ROOT / ".env"):
        # Do not source a shell file or overwrite exported values (including "").
        values = {**dotenv_values(env_file), **os.environ}
        endpoint = values.get("AWS_ENDPOINT_URL", LOCAL_ENDPOINT)
        endpoint = endpoint.strip() if endpoint else None
        if endpoint:
            parsed = urlparse(endpoint)
            if (
                parsed.scheme not in ("http", "https")
                or not parsed.hostname
                or parsed.username
                or parsed.password
            ):
                raise ValueError(
                    "AWS_ENDPOINT_URL must be an HTTP(S) URL without credentials"
                )
        directory = Path(values.get("DATASET_DIR") or "datasets")
        if not directory.is_absolute():
            directory = ROOT / directory
        return cls(
            endpoint=endpoint or None,
            region=values.get("AWS_REGION")
            or values.get("AWS_DEFAULT_REGION")
            or "us-east-1",
            bucket=values.get("S3_BUCKET_EVIDENCE") or "chargeguard-evidence",
            dataset_dir=directory,
            profile=values.get("AWS_PROFILE") or None,
            bank_url=values.get("MOCK_BANK_URL") or "http://localhost:8001",
            merchant_url=values.get("MOCK_MERCHANT_URL") or "http://localhost:8002",
        )

    @property
    def local(self):
        if not self.endpoint:
            return False
        parsed = urlparse(self.endpoint)
        return (
            parsed.hostname in {"localhost", "127.0.0.1", "::1", "localstack"}
            and parsed.port == 4566
        )


def key_schema(pk, sk=None):
    result = [{"AttributeName": pk, "KeyType": "HASH"}]
    if sk:
        result.append({"AttributeName": sk, "KeyType": "RANGE"})
    return result


def table_definition(name, pk, sk=None, indexes=()):
    keys = key_schema(pk, sk)
    gsis = [
        {
            "IndexName": name,
            "KeySchema": key_schema(partition, sort),
            "Projection": {"ProjectionType": "ALL"},
        }
        for name, partition, sort in indexes
    ]
    attributes = {
        key["AttributeName"]
        for schema in [keys] + [gsi["KeySchema"] for gsi in gsis]
        for key in schema
    }
    return {
        "TableName": name,
        "KeySchema": keys,
        "AttributeDefinitions": [
            {"AttributeName": attr, "AttributeType": "S"} for attr in sorted(attributes)
        ],
        "GlobalSecondaryIndexes": gsis,
        "BillingMode": "PAY_PER_REQUEST",
        "DeletionProtectionEnabled": False,
    }


TABLES = (
    table_definition(
        "chargeguard-transactions",
        "user_id",
        "sk",
        (("merchant-index", "merchant_id", "sk"),),
    ),
    table_definition(
        "chargeguard-cases",
        "case_id",
        indexes=(
            ("user-index", "user_id", "created_at"),
            ("status-index", "status", "created_at"),
        ),
    ),
    table_definition(
        "chargeguard-decisions",
        "decision_id",
        indexes=(
            ("case-index", "case_id", "created_at"),
            ("pending-index", "status", "created_at"),
        ),
    ),
)


@dataclass
class Services:
    dynamodb: object
    s3: object


def connect(settings: Settings) -> Services:
    options = {}
    if settings.local:
        # Dummy LocalStack credentials only; do not resolve a real AWS profile.
        core = botocore.session.get_session()
        core.get_component("config_store").set_config_variable("profile", None)
        session = boto3.Session(
            botocore_session=core,
            region_name=settings.region,
            aws_access_key_id="test",
            aws_secret_access_key="test",
        )
    else:
        session = boto3.Session(
            region_name=settings.region, profile_name=settings.profile
        )
    if settings.endpoint:
        options["endpoint_url"] = settings.endpoint
    options["config"] = Config(
        connect_timeout=2,
        read_timeout=5,
        retries={"mode": "standard", "total_max_attempts": 3},
        s3={"addressing_style": "path"} if settings.local else {},
        # Empty AWS_ENDPOINT_URL must not fall back to per-service SDK overrides.
        ignore_configured_endpoint_urls=True,
    )
    return Services(
        session.resource("dynamodb", **options), session.client("s3", **options)
    )


def error_code(exc):
    return exc.response["Error"]["Code"]


def check_table(actual, expected):
    def keys(schema):
        return sorted((key["AttributeName"], key["KeyType"]) for key in schema)

    def indexes(definition):
        return {
            gsi["IndexName"]: (keys(gsi["KeySchema"]), gsi["Projection"])
            for gsi in definition.get("GlobalSecondaryIndexes", [])
        }

    def attrs(obj):
        return sorted(
            (a["AttributeName"], a["AttributeType"])
            for a in obj["AttributeDefinitions"]
        )

    if (
        keys(actual["KeySchema"]) != keys(expected["KeySchema"])
        or attrs(actual) != attrs(expected)
        or indexes(actual) != indexes(expected)
        or actual.get("BillingModeSummary", {}).get("BillingMode") != "PAY_PER_REQUEST"
        or actual.get("DeletionProtectionEnabled", False)
    ):
        raise ValueError(
            f"{expected['TableName']} does not match contract §4.1; refusing to alter it during seed"
        )


def ensure_tables(services: Services):
    client = services.dynamodb.meta.client
    created, reused = [], []
    for definition in TABLES:
        name = definition["TableName"]
        try:
            client.describe_table(TableName=name)
        except ClientError as exc:
            if error_code(exc) != "ResourceNotFoundException":
                raise
            try:
                client.create_table(**definition)
                created.append(name)
            except ClientError as collision:
                if error_code(collision) != "ResourceInUseException":
                    raise
                reused.append(name)
        else:
            reused.append(name)
        client.get_waiter("table_exists").wait(
            TableName=name, WaiterConfig={"Delay": 1, "MaxAttempts": 120}
        )
        actual = client.describe_table(TableName=name)["Table"]
        check_table(actual, definition)
        if any(
            gsi.get("IndexStatus") != "ACTIVE"
            for gsi in actual.get("GlobalSecondaryIndexes", [])
        ):
            raise ValueError(
                f"{name}: indexes are not ACTIVE; retry once provisioning finishes"
            )
        backups = client.describe_continuous_backups(TableName=name)[
            "ContinuousBackupsDescription"
        ]
        if (
            backups.get("PointInTimeRecoveryDescription", {}).get(
                "PointInTimeRecoveryStatus"
            )
            == "ENABLED"
        ):
            raise ValueError(
                f"{name}: PITR must be disabled per contract; refusing to change an existing backup policy"
            )
    return created, reused


def ensure_bucket(services: Services, settings: Settings):
    s3, bucket = services.s3, settings.bucket
    created = False
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as exc:
        if error_code(exc) not in {"404", "NoSuchBucket", "NotFound"}:
            raise
        options = {"Bucket": bucket}
        if settings.region != "us-east-1":
            options["CreateBucketConfiguration"] = {
                "LocationConstraint": settings.region
            }
        try:
            s3.create_bucket(**options)
            created = True
        except ClientError as collision:
            if error_code(collision) != "BucketAlreadyOwnedByYou":
                raise
    if s3.get_bucket_versioning(Bucket=bucket).get("Status") == "Enabled":
        raise ValueError(
            "Evidence bucket has versioning enabled; refusing to change it or create duplicate versions"
        )
    if not created:
        try:
            rules = s3.get_bucket_lifecycle_configuration(Bucket=bucket)["Rules"]
        except ClientError as exc:
            if error_code(exc) != "NoSuchLifecycleConfiguration":
                raise
            rules = []
        if not any(
            rule.get("Status") == "Enabled"
            and rule.get("Expiration", {}).get("Days") == 30
            and (
                rule.get("Filter") == {"Prefix": ""}
                or rule.get("Filter") == {}
                or ("Filter" not in rule and rule.get("Prefix") == "")
            )
            for rule in rules
        ):
            raise ValueError(
                "Existing evidence bucket needs a 30-day lifecycle rule per contract; refusing to overwrite its rules"
            )
    s3.put_public_access_block(
        Bucket=bucket,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    s3.put_bucket_encryption(
        Bucket=bucket,
        ServerSideEncryptionConfiguration={
            "Rules": [
                {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}
            ]
        },
    )
    # Only set lifecycle on a new bucket; do not overwrite unrelated existing rules.
    if created:
        s3.put_bucket_lifecycle_configuration(
            Bucket=bucket,
            LifecycleConfiguration={
                "Rules": [
                    {
                        "ID": "expire-demo-evidence",
                        "Status": "Enabled",
                        "Filter": {"Prefix": ""},
                        "Expiration": {"Days": 30},
                    }
                ]
            },
        )
    return created


def load_dataset(directory: Path):
    transactions = json.loads(
        (directory / "transactions.json").read_text(encoding="utf-8"),
        parse_float=Decimal,
    )
    if not isinstance(transactions, list) or not transactions:
        raise ValueError("transactions.json must be a nonempty array")
    items, identities = [], set()
    for transaction in transactions:
        item = dict(transaction)
        for field in ("user_id", "transaction_id", "posted_at", "merchant_id"):
            if not isinstance(item.get(field), str) or not item[field]:
                raise ValueError(f"Transaction missing {field}")
        item["sk"] = f"{item['posted_at']}#{item['transaction_id']}"
        identity = (item["user_id"], item["sk"])
        if identity in identities:
            raise ValueError("Duplicate transaction primary key in dataset")
        identities.add(identity)
        items.append(item)
    objects = []
    for prefix, extension, content_type in (
        ("invoices", ".pdf", "application/pdf"),
        ("emails", ".eml", "message/rfc822"),
        ("terms", ".pdf", "application/pdf"),
    ):
        files = sorted((directory / prefix).glob(f"*{extension}"))
        if not files:
            raise ValueError(f"Missing evidence files in {prefix}/")
        for path in files:
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"Evidence must be a regular file: {path.name}")
            objects.append((path, f"{prefix}/{path.name}", content_type))
    keys = {key for _, key, _ in objects}
    if any(item.get("invoice_key") not in keys for item in items):
        raise ValueError("A transaction references a missing invoice")
    return items, objects


def seed(settings: Settings, services: Services | None = None, dataset=None):
    items, objects = (
        dataset if dataset is not None else load_dataset(settings.dataset_dir)
    )
    services = services or connect(settings)
    created, reused = ensure_tables(services)
    bucket_created = ensure_bucket(services, settings)
    table = services.dynamodb.Table("chargeguard-transactions")
    with table.batch_writer(overwrite_by_pkeys=["user_id", "sk"]) as writer:
        for item in items:
            writer.put_item(Item=item)
    for path, key, content_type in objects:
        services.s3.put_object(
            Bucket=settings.bucket,
            Key=key,
            Body=path.read_bytes(),
            ContentType=content_type,
        )
    summary = {
        "tables_created": created,
        "tables_reused": reused,
        "bucket_created": bucket_created,
        "items_loaded": len(items),
        "objects_uploaded": len(objects),
    }
    print(json.dumps(summary, sort_keys=True))
    return summary


def main():
    try:
        seed(Settings.from_env())
    except (BotoCoreError, ClientError, OSError, ValueError) as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

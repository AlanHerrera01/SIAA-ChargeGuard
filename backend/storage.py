"""State storage used by the API in local processes and AWS Lambda."""

import json
import os
from collections.abc import Iterator, MutableMapping
from datetime import datetime, timezone
from typing import Any


class DynamoJsonMapping(MutableMapping[str, dict]):
    """A small dict-compatible view over a DynamoDB table.

    Values are stored as JSON so API numbers remain normal Python floats instead
    of leaking DynamoDB ``Decimal`` objects into response models.
    """

    def __init__(
        self,
        table_name: str,
        key_name: str,
        record_type: str,
        index_fields: tuple[str, ...] = (),
    ) -> None:
        import boto3

        endpoint_url = os.getenv("DYNAMODB_ENDPOINT_URL") or os.getenv(
            "DYNAMODB_ENDPOINT"
        )
        self.table = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"),
            endpoint_url=endpoint_url,
        ).Table(table_name)
        self.key_name = key_name
        self.record_type = record_type
        self.index_fields = index_fields

    def __getitem__(self, key: str) -> dict:
        response = self.table.get_item(Key={self.key_name: key}, ConsistentRead=True)
        item = response.get("Item")
        if not item or item.get("record_type") != self.record_type:
            raise KeyError(key)
        return json.loads(item["payload"])

    def __setitem__(self, key: str, value: dict) -> None:
        item: dict[str, Any] = {
            self.key_name: key,
            "record_type": self.record_type,
            "payload": json.dumps(value, separators=(",", ":")),
        }
        for field in self.index_fields:
            field_value = self._index_value(value, field)
            if field_value is not None:
                item[field] = str(field_value)
        self.table.put_item(Item=item)

    def put_if_absent(self, key: str, value: dict) -> bool:
        from botocore.exceptions import ClientError

        item: dict[str, Any] = {
            self.key_name: key,
            "record_type": self.record_type,
            "payload": json.dumps(value, separators=(",", ":")),
        }
        for field in self.index_fields:
            field_value = self._index_value(value, field)
            if field_value is not None:
                item[field] = str(field_value)
        try:
            self.table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(#key)",
                ExpressionAttributeNames={"#key": self.key_name},
            )
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                return False
            raise
        return True

    @staticmethod
    def _index_value(value: dict, field: str):
        if field == "user_id" and field not in value:
            return value.get("transaction", {}).get("user_id")
        if field == "created_at" and field not in value:
            return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return value.get(field)

    def __delitem__(self, key: str) -> None:
        if self.get(key) is None:
            raise KeyError(key)
        self.table.delete_item(Key={self.key_name: key})

    def _items(self) -> list[tuple[str, dict]]:
        items: list[tuple[str, dict]] = []
        scan_kwargs: dict[str, Any] = {
            "FilterExpression": "record_type = :record_type",
            "ExpressionAttributeValues": {":record_type": self.record_type},
            "ProjectionExpression": f"{self.key_name}, payload",
        }
        while True:
            response = self.table.scan(**scan_kwargs)
            items.extend(
                (item[self.key_name], json.loads(item["payload"]))
                for item in response.get("Items", [])
            )
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                return items
            scan_kwargs["ExclusiveStartKey"] = last_key

    def __iter__(self) -> Iterator[str]:
        return iter(key for key, _value in self._items())

    def __len__(self) -> int:
        return len(self._items())

    def clear(self) -> None:
        with self.table.batch_writer() as batch:
            for key, _value in self._items():
                batch.delete_item(Key={self.key_name: key})


def create_state_stores():
    """Use DynamoDB in Lambda (or when explicitly selected), memory otherwise."""
    backend = os.getenv("STATE_BACKEND")
    use_dynamodb = backend == "dynamodb" or (
        backend is None and bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    )
    if not use_dynamodb:
        return {}, {}, {}

    cases_table = os.environ["DYNAMODB_TABLE_CASES"]
    decisions_table = os.environ["DYNAMODB_TABLE_DECISIONS"]
    cases = DynamoJsonMapping(
        cases_table,
        "case_id",
        "case",
        ("user_id", "status", "created_at"),
    )
    decisions = DynamoJsonMapping(
        decisions_table,
        "decision_id",
        "decision",
        ("case_id", "status", "created_at"),
    )
    events = DynamoJsonMapping(
        decisions_table,
        "decision_id",
        "event",
        ("case_id", "status", "created_at"),
    )
    return cases, decisions, events

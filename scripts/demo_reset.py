"""Destructive reset of the three named LocalStack demo tables and BOTH mocks."""

import json
import sys
import time
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, ProxyHandler

from botocore.exceptions import BotoCoreError, ClientError

from seed_local import Settings, TABLES, connect, error_code, load_dataset, seed


def require_local(settings):
    if not settings.local:
        raise ValueError(
            "demo-reset only deletes tables on LocalStack localhost/127.0.0.1/[::1]/localstack:4566; AWS reset is refused"
        )
    for url in (settings.bank_url, settings.merchant_url):
        parsed = urlparse(url)
        if (
            parsed.scheme != "http"
            or parsed.hostname
            not in {"localhost", "127.0.0.1", "::1", "mock-bank", "mock-merchant"}
            or parsed.username
            or parsed.password
        ):
            raise ValueError("demo-reset requires local mock URLs without credentials")


def reset_mocks(settings, opener=None):
    opener = opener or build_opener(ProxyHandler({}))
    outcomes = {}
    for name, url in (("bank", settings.bank_url), ("merchant", settings.merchant_url)):
        try:
            request = Request(url.rstrip("/") + "/demo/reset", method="POST")
            with opener.open(request, timeout=3) as response:
                payload = json.load(response)
                if response.status != 200 or payload != {"status": "ok"}:
                    raise ValueError("Unexpected reset response")
            outcomes[name] = "ok"
        except (URLError, OSError, ValueError) as exc:
            # Continue to the other mock, then report failure rather than false success.
            outcomes[name] = f"failed: {type(exc).__name__}"
    print(json.dumps({"mock_resets": outcomes}, sort_keys=True))
    if any(value != "ok" for value in outcomes.values()):
        raise ValueError(
            "One or more mocks did not reset; storage may already have been reset"
        )
    return outcomes


def reset(settings, services=None, opener=None):
    started = time.monotonic()
    require_local(settings)
    # Validate the full source set before deleting any tables.
    dataset = load_dataset(settings.dataset_dir)
    services = services or connect(settings)
    client = services.dynamodb.meta.client
    targets = [definition["TableName"] for definition in TABLES]
    print(json.dumps({"tables_to_delete": targets, "endpoint": settings.endpoint}))
    for name in targets:
        try:
            client.delete_table(TableName=name)
        except ClientError as exc:
            if error_code(exc) != "ResourceNotFoundException":
                raise
    for name in targets:
        client.get_waiter("table_not_exists").wait(
            TableName=name, WaiterConfig={"Delay": 1, "MaxAttempts": 10}
        )
    result = seed(settings, services, dataset=dataset)
    reset_mocks(settings, opener)
    elapsed = round(time.monotonic() - started, 3)
    print(json.dumps({"reset_seconds": elapsed}))
    if elapsed >= 30:
        raise ValueError("Reset completed but exceeded the 30-second demo budget")
    return result


def main():
    try:
        reset(Settings.from_env())
    except (BotoCoreError, ClientError, OSError, ValueError) as exc:
        print(f"Demo reset failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

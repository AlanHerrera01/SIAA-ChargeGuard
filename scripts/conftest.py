import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--localstack",
        action="store_true",
        help="Run seed integration tests against local LocalStack (writes synthetic data)",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "localstack: requires running LocalStack; upserts synthetic data"
    )


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--localstack"):
        for item in items:
            if "localstack" in item.keywords:
                item.add_marker(
                    pytest.mark.skip(
                        reason="Pass --localstack to enable local integration writes"
                    )
                )

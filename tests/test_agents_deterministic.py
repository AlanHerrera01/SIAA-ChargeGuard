import json
from pathlib import Path

import pytest

from agents.evidence import gather_evidence
from agents.orchestrator import build_evidence_items, map_claim_type


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = PROJECT_ROOT / "datasets"


def load_records(name):
    return json.loads((DATASETS_DIR / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def records():
    transactions = load_records("transactions.json")
    subscriptions = load_records("subscriptions.json")
    return {
        "transactions": {item["transaction_id"]: item for item in transactions},
        "subscriptions": {item["subscription_id"]: item for item in subscriptions},
        "ground_truth": {
            item["type"]: item
            for item in load_records("ground_truth.json")["anomalies"]
        },
    }


def case_inputs(records, anomaly_type):
    anomaly = records["ground_truth"][anomaly_type]
    current = records["transactions"][anomaly["transaction_id"]]
    subscription = records["subscriptions"][current["subscription_id"]]
    previous_transactions = sorted(
        (
            transaction
            for transaction in records["transactions"].values()
            if transaction["subscription_id"] == current["subscription_id"]
            and transaction["posted_at"] < current["posted_at"]
        ),
        key=lambda transaction: transaction["posted_at"],
    )
    previous = previous_transactions[-1] if previous_transactions else None
    return anomaly, current, subscription, previous_transactions, previous


@pytest.mark.parametrize(
    "agent_type,claim_type",
    [
        ("PRICE_INCREASE", "price_hike"),
        ("DUPLICATE_CHARGE", "duplicate_charge"),
        ("POST_CANCELLATION", "charge_after_cancellation"),
        ("NONE", "other"),
    ],
)
def test_claim_type_mapping(agent_type, claim_type):
    assert map_claim_type(agent_type) == claim_type


def test_price_increase_evidence(records, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    _, current, subscription, previous_transactions, previous = case_inputs(
        records, "price_hike"
    )
    evidence = gather_evidence(
        "PRICE_INCREASE", current, previous, subscription["terms_key"], subscription
    )
    items = build_evidence_items(
        "PRICE_INCREASE",
        current,
        previous,
        previous_transactions,
        evidence,
        subscription,
    )
    assert evidence.current_invoice_found
    assert evidence.previous_invoice_found
    assert evidence.subscription_terms_found
    assert not evidence.price_change_notice_found
    assert {item.type for item in items} == {
        "invoice",
        "transaction_history",
        "subscription_terms",
    }


def test_duplicate_evidence(records, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    anomaly, current, subscription, previous_transactions, previous = case_inputs(
        records, "duplicate_charge"
    )
    evidence = gather_evidence(
        "DUPLICATE_CHARGE", current, previous, subscription["terms_key"], subscription
    )
    assert previous["transaction_id"] == anomaly["previous_transaction_id"]
    assert evidence.duplicate_transaction_found
    assert evidence.duplicate_transaction_id == anomaly["previous_transaction_id"]
    assert evidence.duplicate_amount_usd == anomaly["expected_claim_amount_usd"]
    assert evidence.duplicate_seconds_apart == 480
    items = build_evidence_items(
        "DUPLICATE_CHARGE",
        current,
        previous,
        previous_transactions,
        evidence,
        subscription,
    )
    assert {item.type for item in items} == {"invoice", "transaction_history"}


def test_post_cancellation_evidence(records, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    _, current, subscription, previous_transactions, previous = case_inputs(
        records, "charge_after_cancellation"
    )
    evidence = gather_evidence(
        "POST_CANCELLATION", current, previous, subscription["terms_key"], subscription
    )
    assert evidence.cancellation_confirmation_found
    assert evidence.cancelled_at == subscription["cancelled_at"]
    assert evidence.days_after_cancellation == 6
    assert evidence.current_invoice_found
    assert evidence.subscription_terms_found
    items = build_evidence_items(
        "POST_CANCELLATION",
        current,
        previous,
        previous_transactions,
        evidence,
        subscription,
    )
    assert {item.type for item in items} == {
        "email",
        "invoice",
        "other",
        "subscription_terms",
        "transaction_history",
    }

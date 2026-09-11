import argparse
import json
import os
import time
from pathlib import Path
from uuid import uuid4

import httpx

from agents.charge_analysis import ChargeAnalysisResult, analyze_charge
from agents.evidence import EvidenceResult, gather_evidence
from agents.dispute import EvidenceItem, prepare_dispute
from agents.negotiation import evaluate_counter_offer


MERCHANT_API_URL = os.getenv(
    "MERCHANT_API_URL",
    "http://127.0.0.1:8002",
)
MERCHANT_DEMO_SPEED = os.getenv("MERCHANT_DEMO_SPEED", "")
PROJECT_ROOT = Path(__file__).resolve().parent.parent

STEP_ANALYZE = "analyze"
STEP_EVIDENCE = "evidence"
STEP_DISPUTE = "dispute"
STEP_MERCHANT = "merchant"
STEP_NEGOTIATE = "negotiate"

MERCHANT_MAX_ATTEMPTS = int(
    os.getenv("CASE_MERCHANT_MAX_ATTEMPTS", "60")
)
MERCHANT_DECIDED_STATUSES = {
    "counter_offer",
    "resolved_full",
    "denied",
}


def map_claim_type(anomaly_type: str) -> str:
    mapping = {
        "PRICE_INCREASE": "price_hike",
        "DUPLICATE_CHARGE": "duplicate_charge",
        "POST_CANCELLATION": "charge_after_cancellation",
    }

    return mapping.get(anomaly_type, "other")


def submit_dispute(dispute):
    headers = {}
    if MERCHANT_DEMO_SPEED:
        headers["X-Demo-Speed"] = MERCHANT_DEMO_SPEED

    response = httpx.post(
        f"{MERCHANT_API_URL}/disputes",
        json=dispute.model_dump(),
        headers=headers,
        timeout=10.0,
    )

    response.raise_for_status()

    return response.json()


def get_dispute(dispute_id: str):
    response = httpx.get(
        f"{MERCHANT_API_URL}/disputes/{dispute_id}",
        timeout=10.0,
    )

    response.raise_for_status()

    return response.json()


def wait_for_merchant_response(
    dispute_id: str,
    max_attempts: int = 60,
    interval_seconds: float = 0.2,
):
    for _ in range(max_attempts):
        dispute = get_dispute(dispute_id)

        status = dispute["status"]

        print(f"Merchant status: {status}")

        if status in {
            "counter_offer",
            "resolved_full",
            "denied",
        }:
            return dispute

        time.sleep(interval_seconds)

    raise TimeoutError(
        "Merchant did not reach a decision state in time."
    )


def build_evidence_items(
    anomaly_type: str,
    current_transaction: dict,
    previous_transaction: dict | None,
    previous_transactions: list[dict],
    evidence_result,
    subscription: dict | None,
) -> list[EvidenceItem]:

    evidence_items = []

    if anomaly_type == "PRICE_INCREASE":

        if evidence_result.current_invoice_found:
            evidence_items.append(
                EvidenceItem(
                    type="invoice",
                    uri=evidence_result.current_invoice_uri,
                    description=(
                        f"Current invoice for transaction "
                        f"{current_transaction['transaction_id']}."
                    ),
                )
            )

        if evidence_result.previous_invoice_found:
            evidence_items.append(
                EvidenceItem(
                    type="invoice",
                    uri=evidence_result.previous_invoice_uri,
                    description=(
                        "Previous invoice showing the historical "
                        "subscription charge."
                    ),
                )
            )

        previous_amounts = [
            tx["amount_usd"]
            for tx in previous_transactions
        ]

        evidence_items.append(
            EvidenceItem(
                type="transaction_history",
                uri=None,
                description=(
                    "Previous recurring charges for the "
                    f"subscription: {previous_amounts}"
                ),
            )
        )

        if evidence_result.subscription_terms_found:
            evidence_items.append(
                EvidenceItem(
                    type="subscription_terms",
                    uri=evidence_result.subscription_terms_uri,
                    description=(
                        "Subscription terms associated "
                        "with this subscription."
                    ),
                )
            )

    elif anomaly_type == "DUPLICATE_CHARGE":

        if (
            evidence_result.duplicate_transaction_found
            and previous_transaction
        ):
            evidence_items.append(
                EvidenceItem(
                    type="transaction_history",
                    uri=None,
                    description=(
                        f"Transaction "
                        f"{previous_transaction['transaction_id']} "
                        f"charged "
                        f"${previous_transaction['amount_usd']:.2f} "
                        f"{previous_transaction['currency']} "
                        f"at {previous_transaction['posted_at']}."
                    ),
                )
            )

            evidence_items.append(
                EvidenceItem(
                    type="transaction_history",
                    uri=None,
                    description=(
                        f"Transaction "
                        f"{current_transaction['transaction_id']} "
                        f"charged another "
                        f"${current_transaction['amount_usd']:.2f} "
                        f"{current_transaction['currency']} "
                        f"at {current_transaction['posted_at']}, "
                        f"only "
                        f"{evidence_result.duplicate_seconds_apart:.0f} "
                        f"seconds after the previous charge."
                    ),
                )
            )

        if evidence_result.previous_invoice_found:
            evidence_items.append(
                EvidenceItem(
                    type="invoice",
                    uri=evidence_result.previous_invoice_uri,
                    description=(
                        "Invoice associated with the first "
                        "same-day transaction."
                    ),
                )
            )

        if evidence_result.current_invoice_found:
            evidence_items.append(
                EvidenceItem(
                    type="invoice",
                    uri=evidence_result.current_invoice_uri,
                    description=(
                        "Invoice associated with the suspected "
                        "duplicate transaction."
                    ),
                )
            )

    elif anomaly_type == "POST_CANCELLATION":

        if evidence_result.cancellation_confirmation_found:
            evidence_items.append(
                EvidenceItem(
                    type="email",
                    uri=evidence_result.cancellation_email_uri,
                    description=(
                        f"Cancellation confirmation for "
                        f"subscription "
                        f"{current_transaction['subscription_id']} "
                        f"dated {evidence_result.cancelled_at}."
                    ),
                )
            )

        evidence_items.append(
            EvidenceItem(
                type="transaction_history",
                uri=None,
                description=(
                    f"Transaction "
                    f"{current_transaction['transaction_id']} "
                    f"charged "
                    f"${current_transaction['amount_usd']:.2f} "
                    f"{current_transaction['currency']} "
                    f"on {current_transaction['posted_at']}, "
                    f"{evidence_result.days_after_cancellation} "
                    f"days after cancellation."
                ),
            )
        )

        if subscription:
            evidence_items.append(
                EvidenceItem(
                    type="other",
                    uri=None,
                    description=(
                        f"Subscription "
                        f"{subscription['subscription_id']} "
                        f"has status "
                        f"{subscription['status']} "
                        f"with cancelled_at "
                        f"{subscription['cancelled_at']}."
                    ),
                )
            )

        if evidence_result.current_invoice_found:
            evidence_items.append(
                EvidenceItem(
                    type="invoice",
                    uri=evidence_result.current_invoice_uri,
                    description=(
                        "Invoice associated with the "
                        "post-cancellation transaction."
                    ),
                )
            )

        if evidence_result.subscription_terms_found:
            evidence_items.append(
                EvidenceItem(
                    type="subscription_terms",
                    uri=evidence_result.subscription_terms_uri,
                    description=(
                        "Subscription terms associated "
                        "with the cancelled subscription."
                    ),
                )
            )

    return evidence_items


def load_case_inputs(transaction_id: str) -> dict:
    """Read the canonical datasets and resolve everything one case needs."""
    transactions_path = PROJECT_ROOT / "datasets" / "transactions.json"
    subscriptions_path = PROJECT_ROOT / "datasets" / "subscriptions.json"

    with open(
        transactions_path,
        "r",
        encoding="utf-8",
    ) as file:
        transactions = json.load(file)

    with open(
        subscriptions_path,
        "r",
        encoding="utf-8",
    ) as file:
        subscriptions = json.load(file)

    current_transaction = next(
        tx
        for tx in transactions
        if tx["transaction_id"] == transaction_id
    )

    subscription = next(
        (
            sub
            for sub in subscriptions
            if sub["subscription_id"]
            == current_transaction["subscription_id"]
        ),
        None,
    )

    previous_transactions = sorted(
        [
            tx
            for tx in transactions
            if tx["subscription_id"]
            == current_transaction["subscription_id"]
            and tx["posted_at"]
            < current_transaction["posted_at"]
        ],
        key=lambda tx: tx["posted_at"],
    )

    return {
        "current_transaction": current_transaction,
        "subscription": subscription,
        "previous_transactions": previous_transactions,
        "previous_transaction": (
            previous_transactions[-1]
            if previous_transactions
            else None
        ),
    }


def create_case_state(transaction_id: str) -> dict:
    """Build the JSON-safe state that carries a case across HTTP calls."""
    return {
        "transaction_id": transaction_id,
        "step": STEP_ANALYZE,
        "done": False,
        "retry": False,
        "merchant_attempts": 0,
        "last_merchant_status": None,
        "dispute_id": None,
        "charge_analysis": None,
        "evidence": None,
        "dispute": None,
        "merchant_response": None,
        "negotiation": None,
    }


def _finish(state: dict) -> dict:
    state["step"] = None
    state["done"] = True
    state["retry"] = False
    return state


def _step_analyze(state: dict) -> tuple[dict, list[dict]]:
    inputs = load_case_inputs(state["transaction_id"])

    charge_result = analyze_charge(
        current_transaction=inputs["current_transaction"],
        previous_transactions=inputs["previous_transactions"],
        subscription=inputs["subscription"],
    )

    state["charge_analysis"] = charge_result.model_dump()

    if not charge_result.is_anomaly:
        return _finish(state), [
            {
                "actor": "chargeguard",
                "event": "transaction_analyzed",
                "detail": charge_result.reason,
            }
        ]

    state["step"] = STEP_EVIDENCE

    return state, [
        {
            "actor": "chargeguard",
            "event": "anomaly_detected",
            "detail": charge_result.reason,
        }
    ]


def _step_evidence(state: dict) -> tuple[dict, list[dict]]:
    inputs = load_case_inputs(state["transaction_id"])
    subscription = inputs["subscription"]

    evidence_result = gather_evidence(
        anomaly_type=state["charge_analysis"]["type"],
        current_transaction=inputs["current_transaction"],
        previous_transaction=inputs["previous_transaction"],
        terms_key=(
            subscription.get("terms_key")
            if subscription
            else None
        ),
        subscription=subscription,
    )

    state["evidence"] = evidence_result.model_dump()
    state["step"] = STEP_DISPUTE

    return state, [
        {
            "actor": "chargeguard",
            "event": "evidence_gathered",
            "detail": evidence_result.summary,
        }
    ]


def _step_dispute(state: dict) -> tuple[dict, list[dict]]:
    inputs = load_case_inputs(state["transaction_id"])
    current_transaction = inputs["current_transaction"]
    charge_result = ChargeAnalysisResult(**state["charge_analysis"])
    evidence_result = EvidenceResult(**state["evidence"])

    evidence_items = build_evidence_items(
        anomaly_type=charge_result.type,
        current_transaction=current_transaction,
        previous_transaction=inputs["previous_transaction"],
        previous_transactions=inputs["previous_transactions"],
        evidence_result=evidence_result,
        subscription=inputs["subscription"],
    )

    dispute_result = prepare_dispute(
        case_id=f"case_{uuid4().hex[:8]}",
        merchant_id=current_transaction["merchant_id"],
        merchant_name=current_transaction["merchant_name"],
        user_id=current_transaction["user_id"],
        transaction_id=current_transaction["transaction_id"],
        claim_type=map_claim_type(charge_result.type),
        expected_amount_usd=charge_result.expected_amount,
        actual_amount_usd=charge_result.actual_amount,
        requested_amount_usd=charge_result.difference,
        currency=current_transaction["currency"],
        anomaly_reason=charge_result.reason,
        evidence=evidence_items,
    )

    submitted_dispute = submit_dispute(dispute_result)

    state["dispute"] = dispute_result.model_dump()
    state["merchant_response"] = submitted_dispute
    state["dispute_id"] = submitted_dispute["dispute_id"]
    state["last_merchant_status"] = submitted_dispute["status"]
    state["step"] = STEP_MERCHANT

    return state, [
        {
            "actor": "chargeguard",
            "event": "dispute_filed",
            "detail": dispute_result.message,
        }
    ]


def _step_merchant(state: dict) -> tuple[dict, list[dict]]:
    """Poll the merchant exactly once so the caller controls the waiting."""
    merchant_response = get_dispute(state["dispute_id"])
    status = merchant_response["status"]

    state["merchant_response"] = merchant_response
    state["merchant_attempts"] = state["merchant_attempts"] + 1

    events = []
    if status != state["last_merchant_status"]:
        state["last_merchant_status"] = status
        offer = merchant_response.get("offer") or {}
        events.append(
            {
                "actor": "merchant_api",
                "event": (
                    "merchant_response"
                    if status in MERCHANT_DECIDED_STATUSES
                    else "merchant_reviewing"
                ),
                "detail": offer.get("message") or MERCHANT_STATUS_DETAIL.get(
                    status, status
                ),
            }
        )

    if status in MERCHANT_DECIDED_STATUSES:
        state["retry"] = False
        if status == "counter_offer":
            state["step"] = STEP_NEGOTIATE
        else:
            _finish(state)
        return state, events

    if state["merchant_attempts"] >= MERCHANT_MAX_ATTEMPTS:
        raise TimeoutError(
            "Merchant did not reach a decision state in time."
        )

    state["retry"] = True
    return state, events


def _step_negotiate(state: dict) -> tuple[dict, list[dict]]:
    merchant_response = state["merchant_response"]
    offer = merchant_response["offer"]

    negotiation_result = evaluate_counter_offer(
        requested_amount_usd=merchant_response["requested_amount_usd"],
        offered_amount_usd=offer["amount_usd"],
        dispute_reason=state["charge_analysis"]["reason"],
        evidence_summary=state["evidence"]["summary"],
    )

    state["negotiation"] = negotiation_result.model_dump()
    _finish(state)

    return state, [
        {
            "actor": "chargeguard",
            "event": "negotiation_evaluated",
            "detail": negotiation_result.reason,
        }
    ]


MERCHANT_STATUS_DETAIL = {
    "submitted": "The merchant received the dispute.",
    "under_review": (
        "The merchant is reviewing the claim and supporting evidence."
    ),
}

STEP_HANDLERS = {
    STEP_ANALYZE: _step_analyze,
    STEP_EVIDENCE: _step_evidence,
    STEP_DISPUTE: _step_dispute,
    STEP_MERCHANT: _step_merchant,
    STEP_NEGOTIATE: _step_negotiate,
}


def advance_case_state(state: dict) -> tuple[dict, list[dict]]:
    """Run one pipeline step and return the new state plus fresh events.

    Events carry no timestamp on purpose: the caller stamps them with the
    real wall clock, so the timeline reflects when work actually happened.
    """
    step = state.get("step")

    if state.get("done") or step is None:
        return state, []

    state["retry"] = False

    return STEP_HANDLERS[step](state)


def case_state_result(state: dict) -> dict:
    """Project the step state onto the legacy result shape."""
    return {
        "charge_analysis": state["charge_analysis"],
        "evidence": state["evidence"],
        "dispute": state["dispute"],
        "merchant_response": (
            state["merchant_response"]
            if state["dispute"]
            else None
        ),
        "negotiation": state["negotiation"],
    }


def run_chargeguard_case(transaction_id: str):
    """Run every step back to back, keeping the original blocking behavior."""
    state = create_case_state(transaction_id)

    while not state["done"]:
        state, _events = advance_case_state(state)

        if state["retry"]:
            time.sleep(0.2)

    return case_state_result(state)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run a ChargeGuard case")
    parser.add_argument(
        "transaction_id",
        help="Canonical transaction ID, for example txn_0031",
    )
    transaction_id = parser.parse_args().transaction_id

    result = run_chargeguard_case(
        transaction_id
    )

    print("\n--- CHARGE ANALYSIS ---")
    print(result["charge_analysis"])

    print("\n--- EVIDENCE ---")
    print(result["evidence"])

    print("\n--- DISPUTE ---")
    print(result["dispute"])

    print("\n--- MERCHANT RESPONSE ---")
    print(result["merchant_response"])

    print("\n--- HUMAN DECISION REQUIRED ---")
    print(result["negotiation"])

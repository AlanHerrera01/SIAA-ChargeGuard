import importlib.util
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import pytest

from backend import main as backend


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = PROJECT_ROOT / "datasets"
pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


def successful_result():
    return {
        "charge_analysis": {
            "is_anomaly": False,
            "type": "NONE",
            "expected_amount": 19.99,
            "actual_amount": 19.99,
            "difference": 0.0,
            "confidence": 1.0,
            "reason": "Test result",
        },
        "evidence": None,
        "dispute": None,
        "merchant_response": None,
        "negotiation": None,
    }


def reset_backend_state():
    backend.CASES.clear()
    backend.PENDING_DECISIONS.clear()
    backend.EVENTS.clear()
    backend.load_datasets()


def event_for(transaction_id="txn_0031", event_id="evt_backend_test"):
    if backend.TRANSACTIONS is None:
        backend.load_datasets()
    transaction = backend.find_transaction(transaction_id)
    assert transaction is not None
    return {
        "event_id": event_id,
        "event_type": "transaction.posted",
        "occurred_at": transaction["posted_at"],
        "data": dict(transaction),
    }


@asynccontextmanager
async def backend_client():
    reset_backend_state()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=backend.app),
        base_url="http://backend.test",
        trust_env=False,
    ) as client:
        yield client


async def test_valid_webhook_is_accepted_and_completed(monkeypatch):
    calls = []

    def run(transaction_id):
        calls.append(transaction_id)
        return successful_result()

    monkeypatch.setattr(backend, "run_chargeguard_case", run)
    async with backend_client() as client:
        response = await client.post("/transactions/webhook", json=event_for())
        assert response.status_code == 202
        assert response.json() == {
            "status": "accepted",
            "event_id": "evt_backend_test",
            "event_type": "transaction.posted",
            "transaction_id": "txn_0031",
            "duplicate": False,
        }
        event = (await client.get("/events/evt_backend_test")).json()
        assert event["status"] == "completed"
        assert event["case_id"].startswith("case_")
        assert event["error"] is None
        assert "payload" not in event
        assert calls == ["txn_0031"]


async def test_legacy_webhook_shape_is_rejected(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: successful_result())
    async with backend_client() as client:
        response = await client.post(
            "/transactions/webhook",
            json={"transaction_id": "txn_0031", "event_type": "transaction.posted"},
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
        assert backend.EVENTS == {}


async def test_missing_transaction_is_rejected(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: successful_result())
    payload = event_for()
    payload["data"]["transaction_id"] = "txn_missing"
    async with backend_client() as client:
        response = await client.post("/transactions/webhook", json=payload)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "transaction_not_found"


@pytest.mark.parametrize(
    "change",
    [
        {"amount_usd": 999.99},
        {"merchant_id": "mrc_other"},
        {"subscription_id": "sub_other"},
    ],
)
async def test_transaction_payload_mismatch_is_rejected(monkeypatch, change):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: successful_result())
    payload = event_for()
    payload["data"].update(change)
    async with backend_client() as client:
        response = await client.post("/transactions/webhook", json=payload)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "transaction_payload_mismatch"


async def test_event_clock_must_match_transaction(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: successful_result())
    payload = event_for()
    payload["occurred_at"] = "2026-09-14T09:11:00Z"
    async with backend_client() as client:
        response = await client.post("/transactions/webhook", json=payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


async def test_same_event_is_idempotent(monkeypatch):
    calls = []

    def run(transaction_id):
        calls.append(transaction_id)
        return successful_result()

    monkeypatch.setattr(backend, "run_chargeguard_case", run)
    payload = event_for()
    async with backend_client() as client:
        first = await client.post("/transactions/webhook", json=payload)
        second = await client.post("/transactions/webhook", json=payload)
        assert first.status_code == second.status_code == 202
        assert second.json()["duplicate"] is True
        assert second.json()["status"] == "completed"
        assert calls == ["txn_0031"]
        assert len(backend.EVENTS) == 1
        assert len(backend.CASES) == 1


async def test_reused_event_id_with_different_payload_conflicts(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: successful_result())
    async with backend_client() as client:
        first = await client.post("/transactions/webhook", json=event_for())
        assert first.status_code == 202
        conflicting = event_for("txn_0032")
        response = await client.post("/transactions/webhook", json=conflicting)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "event_payload_conflict"
        assert len(backend.EVENTS) == 1


async def test_background_failure_is_observable(monkeypatch):
    def fail(_transaction_id):
        raise RuntimeError("Bedrock must not be called in this test")

    monkeypatch.setattr(backend, "run_chargeguard_case", fail)
    async with backend_client() as client:
        response = await client.post("/transactions/webhook", json=event_for())
        assert response.status_code == 202
        event = (await client.get("/events/evt_backend_test")).json()
        assert event["status"] == "failed"
        assert event["case_id"] is None
        assert event["error"] == {
            "code": "case_processing_failed",
            "message": "Transaction analysis could not be completed",
        }
        assert backend.CASES == {}


async def test_event_listing_missing_event_and_reset(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: successful_result())
    async with backend_client() as client:
        await client.post("/transactions/webhook", json=event_for())
        events = (await client.get("/events")).json()
        assert len(events) == 1 and "payload" not in events[0]
        missing = await client.get("/events/evt_missing")
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "event_not_found"
        reset = await client.post("/demo/reset")
        assert reset.status_code == 200
        assert backend.EVENTS == {}
        assert backend.CASES == {}
        assert backend.PENDING_DECISIONS == {}


def load_mock_bank_module():
    path = PROJECT_ROOT / "mock-services" / "bank" / "api.py"
    spec = importlib.util.spec_from_file_location("chargeguard_bank_integration", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_mock_merchant_module():
    path = PROJECT_ROOT / "mock-services" / "merchant" / "api.py"
    spec = importlib.util.spec_from_file_location(
        "chargeguard_merchant_integration", path
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


async def test_mock_bank_delivers_real_envelope_to_backend(monkeypatch):
    calls = []

    def run(transaction_id):
        calls.append(transaction_id)
        return successful_result()

    monkeypatch.setattr(backend, "run_chargeguard_case", run)
    monkeypatch.setenv(
        "BACKEND_WEBHOOK_URL", "http://backend.test/transactions/webhook"
    )
    reset_backend_state()
    bank = load_mock_bank_module()
    bank_app = bank.create_app(
        DATASETS_DIR,
        webhook_transport=httpx.ASGITransport(app=backend.app),
    )

    async with bank_app.router.lifespan_context(bank_app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=bank_app),
            base_url="http://bank.test",
            trust_env=False,
        ) as client:
            response = await client.post(
                "/transactions/notify", json={"transaction_id": "txn_0031"}
            )

    assert response.status_code == 200
    assert response.json() == {"delivered": True, "status_code": 202}
    assert calls == ["txn_0031"]
    assert len(backend.EVENTS) == 1
    event = next(iter(backend.EVENTS.values()))
    assert event["event_id"].startswith("evt_")
    assert event["event_type"] == "transaction.posted"
    assert event["transaction_id"] == "txn_0031"
    assert event["status"] == "completed"


def pending_case():
    case = {
        "case_id": "case_decision_test",
        "transaction": {
            "transaction_id": "txn_0031",
            "subscription_id": "sub_001",
            "merchant_id": "mrc_netflix",
            "merchant_name": "Netflix",
            "amount_usd": 19.99,
            "currency": "USD",
            "posted_at": "2026-09-14T09:10:00Z",
            "description": "NETFLIX.COM LOS GATOS CA",
        },
        "anomaly": {
            "is_anomaly": True,
            "type": "PRICE_INCREASE",
            "expected_amount_usd": 15.49,
            "actual_amount_usd": 19.99,
            "claimed_amount_usd": 4.50,
            "confidence": 0.98,
            "reason": "The recurring charge increased.",
        },
        "evidence": [],
        "dispute": {
            "dispute_id": "dsp_decision_test",
            "claim_type": "price_hike",
            "requested_amount_usd": 4.50,
            "message": "Canonical integration test claim.",
        },
        "merchant": {
            "status": "counter_offer",
            "offer": None,
            "resolution": None,
        },
        "decision": {
            "required": True,
            "recommendation": "reject_and_request_full_refund",
            "reason": "The evidence supports the full refund.",
        },
        "status": "awaiting_human",
        "timeline": [],
        "created_at": "2026-09-14T09:10:00Z",
        "updated_at": "2026-09-14T09:10:04Z",
    }
    backend.CASES[case["case_id"]] = case
    backend.PENDING_DECISIONS[case["case_id"]] = {
        "case_id": case["case_id"],
        "dispute_id": "dsp_decision_test",
        "merchant_name": "Netflix",
        "requested_amount_usd": 4.50,
        "offered_amount_usd": 2.70,
        "currency": "USD",
        "recommendation": "reject_and_request_full_refund",
        "reason": "The evidence supports the full refund.",
        "status": "pending",
    }
    return case


async def test_accept_offer_requires_terminal_acceptance(monkeypatch):
    reset_backend_state()
    case = pending_case()
    calls = []

    async def request(method, path, payload=None):
        calls.append((method, path, payload))
        return {
            "status": "resolved_accepted",
            "resolution": {"outcome": "accepted", "refund_amount_usd": 2.70},
        }

    monkeypatch.setattr(backend, "merchant_request", request)
    result = await backend.resolve_merchant_decision(
        case,
        backend.DecisionResolutionRequest(decision="accept_offer"),
    )
    assert result["status"] == "resolved"
    assert result["merchant"]["status"] == "resolved_accepted"
    assert result["merchant"]["resolution"]["refund_amount_usd"] == 2.70
    assert case["case_id"] not in backend.PENDING_DECISIONS
    assert calls == [
        ("POST", "/disputes/dsp_decision_test/accept", None),
    ]


@pytest.mark.parametrize(
    "terminal_status,outcome,refund",
    [
        ("resolved_full", "full_refund", 4.50),
        ("denied", "denied", 0.0),
    ],
)
async def test_reject_polls_until_terminal(
    monkeypatch, terminal_status, outcome, refund
):
    reset_backend_state()
    case = pending_case()
    calls = []
    responses = iter(
        [
            {"status": "escalated", "resolution": None},
            {"status": "escalated", "resolution": None},
            {
                "status": terminal_status,
                "resolution": {
                    "outcome": outcome,
                    "refund_amount_usd": refund,
                },
            },
        ]
    )

    async def request(method, path, payload=None):
        calls.append((method, path, payload))
        return next(responses)

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(backend, "merchant_request", request)
    monkeypatch.setattr(backend.asyncio, "sleep", no_sleep)
    result = await backend.resolve_merchant_decision(
        case,
        backend.DecisionResolutionRequest(
            decision="reject_and_request_full_refund",
            reason="Full refund requested",
        ),
    )
    assert result["status"] == "resolved"
    assert result["merchant"]["status"] == terminal_status
    assert result["merchant"]["resolution"]["outcome"] == outcome
    assert case["case_id"] not in backend.PENDING_DECISIONS
    assert calls[0] == (
        "POST",
        "/disputes/dsp_decision_test/reject",
        {"reason": "Full refund requested"},
    )
    assert [call[0] for call in calls].count("POST") == 1
    assert [call[0] for call in calls].count("GET") == 2


async def test_reject_timeout_stays_awaiting_merchant(monkeypatch):
    reset_backend_state()
    case = pending_case()
    calls = []

    async def request(method, path, payload=None):
        calls.append((method, path, payload))
        return {"status": "escalated", "resolution": None}

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(backend, "merchant_request", request)
    monkeypatch.setattr(backend.asyncio, "sleep", no_sleep)
    monkeypatch.setattr(backend, "MERCHANT_POLL_MAX_ATTEMPTS", 2)
    result = await backend.resolve_merchant_decision(
        case,
        backend.DecisionResolutionRequest(
            decision="reject_and_request_full_refund"
        ),
    )
    assert result["status"] == "awaiting_merchant"
    assert result["merchant"]["status"] == "escalated"
    assert case["case_id"] not in backend.PENDING_DECISIONS
    assert [call[0] for call in calls] == ["POST", "GET", "GET"]


async def test_unexpected_accept_status_preserves_pending_decision(monkeypatch):
    reset_backend_state()
    case = pending_case()

    async def request(_method, _path, _payload=None):
        return {"status": "counter_offer", "resolution": None}

    monkeypatch.setattr(backend, "merchant_request", request)
    with pytest.raises(backend.APIError) as exc_info:
        await backend.resolve_merchant_decision(
            case,
            backend.DecisionResolutionRequest(decision="accept_offer"),
        )
    assert exc_info.value.code == "unexpected_merchant_status"
    assert case["status"] == "awaiting_human"
    assert case["case_id"] in backend.PENDING_DECISIONS


async def test_merchant_failure_uses_safe_error_envelope(monkeypatch):
    reset_backend_state()
    case = pending_case()

    async def request(_method, _path, _payload=None):
        raise backend.APIError(
            502,
            "merchant_service_unavailable",
            "Merchant service is unavailable",
        )

    monkeypatch.setattr(backend, "merchant_request", request)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=backend.app),
        base_url="http://backend.test",
        trust_env=False,
    ) as client:
        response = await client.post(
            f"/decisions/{case['case_id']}/resolve",
            json={"decision": "accept_offer"},
        )
    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "merchant_service_unavailable",
            "message": "Merchant service is unavailable",
        }
    }
    assert case["case_id"] in backend.PENDING_DECISIONS


def test_merchant_url_precedence(monkeypatch):
    monkeypatch.setenv("MERCHANT_API_URL", "http://preferred:8002/")
    monkeypatch.setenv("MOCK_MERCHANT_URL", "http://legacy:8002")
    assert backend.merchant_api_url() == "http://preferred:8002"
    monkeypatch.delenv("MERCHANT_API_URL")
    assert backend.merchant_api_url() == "http://legacy:8002"
    monkeypatch.delenv("MOCK_MERCHANT_URL")
    assert backend.merchant_api_url() == "http://127.0.0.1:8002"


@pytest.mark.parametrize(
    "merchant_id,terminal_status,outcome",
    [
        ("mrc_netflix", "resolved_full", "full_refund"),
        ("mrc_fitlife", "denied", "denied"),
    ],
)
async def test_backend_rejection_with_real_mock_merchant(
    monkeypatch, merchant_id, terminal_status, outcome
):
    reset_backend_state()
    merchant = load_mock_merchant_module()
    merchant_app = merchant.create_app(DATASETS_DIR)
    monkeypatch.setenv("MERCHANT_API_URL", "http://merchant.test")
    backend.app.state.merchant_transport = httpx.ASGITransport(app=merchant_app)

    claim = {
        "case_id": "case_decision_test",
        "merchant_id": merchant_id,
        "user_id": "usr_demo",
        "transaction_id": "txn_0031",
        "claim_type": "price_hike",
        "requested_amount_usd": 4.50,
        "currency": "USD",
        "message": "Canonical integration test claim.",
        "evidence": [],
    }

    try:
        async with merchant_app.router.lifespan_context(merchant_app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=merchant_app),
                base_url="http://merchant.test",
                trust_env=False,
            ) as merchant_client:
                created = await merchant_client.post(
                    "/disputes",
                    json=claim,
                    headers={"X-Demo-Speed": "instant"},
                )
                dispute_id = created.json()["dispute_id"]
                assert (await merchant_client.get(
                    f"/disputes/{dispute_id}"
                )).json()["status"] == "counter_offer"

            case = pending_case()
            case["dispute"]["dispute_id"] = dispute_id
            result = await backend.resolve_merchant_decision(
                case,
                backend.DecisionResolutionRequest(
                    decision="reject_and_request_full_refund",
                    reason="Requesting the full supported refund",
                ),
            )
    finally:
        del backend.app.state.merchant_transport

    assert result["status"] == "resolved"
    assert result["merchant"]["status"] == terminal_status
    assert result["merchant"]["resolution"]["outcome"] == outcome

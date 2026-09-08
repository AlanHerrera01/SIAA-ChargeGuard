from contextlib import asynccontextmanager

import httpx
import pytest

from backend import main as backend


pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


@asynccontextmanager
async def backend_client():
    backend.CASES.clear()
    backend.PENDING_DECISIONS.clear()
    backend.EVENTS.clear()
    backend.load_datasets()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=backend.app),
        base_url="http://backend.test",
        trust_env=False,
    ) as client:
        yield client


def anomalous_result():
    return {
        "charge_analysis": {
            "is_anomaly": True,
            "type": "PRICE_INCREASE",
            "expected_amount": 10.99,
            "actual_amount": 14.99,
            "difference": 4.0,
            "confidence": 0.98,
            "reason": "The recurring charge increased.",
        },
        "evidence": {
            "summary": "Current and previous invoices support the price increase.",
        },
        "dispute": {
            "case_id": "case_contract_test",
            "merchant_id": "mrc_spotify",
            "user_id": "usr_demo",
            "transaction_id": "txn_0031",
            "claim_type": "price_hike",
            "requested_amount_usd": 4.0,
            "currency": "USD",
            "message": "Professional dispute message.",
            "evidence": [
                {
                    "type": "invoice",
                    "uri": "datasets/invoices/inv_0031.pdf",
                    "description": "Current invoice.",
                }
            ],
        },
        "merchant_response": {
            "dispute_id": "dsp_contract_test",
            "case_id": "case_contract_test",
            "merchant_id": "mrc_spotify",
            "transaction_id": "txn_0031",
            "status": "counter_offer",
            "requested_amount_usd": 4.0,
            "created_at": "2026-09-14T09:10:00Z",
            "updated_at": "2026-09-14T09:10:04Z",
            "offer": {
                "amount_usd": 2.7,
                "message": "Courtesy credit.",
                "expires_at": "2026-09-21T09:10:04Z",
            },
            "resolution": None,
            "history": [],
        },
        "negotiation": {
            "recommendation": "reject_and_request_full_refund",
            "rationale": "The evidence supports the full refund.",
        },
    }


async def test_case_detail_contract(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: anomalous_result())

    async with backend_client() as client:
        response = await client.post("/cases/analyze", json={"transaction_id": "txn_0031"})
        assert response.status_code == 200
        payload = response.json()

    assert set(payload) == {
        "case_id",
        "transaction",
        "anomaly",
        "evidence",
        "dispute",
        "merchant",
        "decision",
        "status",
        "timeline",
        "created_at",
        "updated_at",
    }
    assert payload["status"] == "awaiting_human"
    assert payload["anomaly"]["claimed_amount_usd"] == 4.0
    assert "difference" not in payload["anomaly"]
    assert payload["decision"] == {
        "required": True,
        "recommendation": "reject_and_request_full_refund",
        "reason": "The evidence supports the full refund.",
    }


async def test_case_list_and_pending_decisions_use_items(monkeypatch):
    monkeypatch.setattr(backend, "run_chargeguard_case", lambda _id: anomalous_result())

    async with backend_client() as client:
        await client.post("/cases/analyze", json={"transaction_id": "txn_0031"})
        cases = (await client.get("/cases")).json()
        decisions = (await client.get("/decisions/pending")).json()

    assert set(cases) == {"items"}
    assert cases["items"][0] == {
        "case_id": "case_contract_test",
        "transaction_id": "txn_0031",
        "merchant_id": "mrc_netflix",
        "merchant_name": "Netflix",
        "anomaly_type": "PRICE_INCREASE",
        "claimed_amount_usd": 4.0,
        "currency": "USD",
        "status": "awaiting_human",
        "created_at": "2026-09-14T09:10:00Z",
        "updated_at": "2026-09-14T09:10:04Z",
    }
    assert set(decisions) == {"items"}
    assert decisions["items"][0]["case_id"] == "case_contract_test"
    assert decisions["items"][0]["offered_amount_usd"] == 2.7
    assert decisions["items"][0]["status"] == "pending"


async def test_public_errors_use_error_envelope():
    async with backend_client() as client:
        response = await client.get("/cases/case_missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "case_not_found",
            "message": "Case not found",
        }
    }

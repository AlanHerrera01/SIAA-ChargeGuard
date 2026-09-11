"""Tests for the stepped (real-time) case workflow.

These cover the flow the UI drives: POST /cases/start, then one
POST /cases/{case_id}/advance per agent step, so the timeline grows in front
of the user instead of arriving complete.
"""

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


def stub_agents(monkeypatch, merchant_statuses):
    """Replace every LLM and HTTP call so the stepped flow runs offline."""
    from agents import orchestrator
    from agents.charge_analysis import ChargeAnalysisResult
    from agents.dispute import DisputeResult
    from agents.evidence import EvidenceResult
    from agents.negotiation import NegotiationResult

    analysis = ChargeAnalysisResult(
        is_anomaly=True,
        type="DUPLICATE_CHARGE",
        expected_amount=10.99,
        actual_amount=10.99,
        difference=10.99,
        confidence=0.95,
        reason="Duplicate charge detected.",
    )
    evidence = EvidenceResult(
        merchant_id="mrc_spotify",
        merchant_name="Spotify",
        subscription_id="sub_003",
        transaction_id="txn_0035",
        anomaly_type="DUPLICATE_CHARGE",
        previous_invoice_found=True,
        current_invoice_found=True,
        price_change_notice_found=False,
        subscription_terms_found=True,
        duplicate_transaction_found=True,
        duplicate_transaction_id="txn_0034",
        duplicate_amount_usd=10.99,
        duplicate_seconds_apart=480.0,
        cancellation_confirmation_found=False,
        cancellation_email_uri=None,
        cancelled_at=None,
        days_after_cancellation=None,
        previous_invoice_uri="s3://demo/invoices/inv_0034.pdf",
        current_invoice_uri="s3://demo/invoices/inv_0035.pdf",
        subscription_terms_uri="s3://demo/terms/sub_003.pdf",
        summary="Both invoices are available.",
    )
    dispute = DisputeResult(
        case_id="case_from_agent",
        merchant_id="mrc_spotify",
        user_id="usr_demo",
        transaction_id="txn_0035",
        claim_type="duplicate_charge",
        requested_amount_usd=10.99,
        currency="USD",
        message="Dear Spotify Support, this charge is duplicated.",
        evidence=[],
    )
    negotiation = NegotiationResult(
        decision_required=True,
        recommendation="reject_and_request_full_refund",
        requested_amount_usd=10.99,
        offered_amount_usd=6.59,
        difference_usd=4.40,
        reason="The evidence supports the full refund.",
    )

    polls = iter(merchant_statuses)

    def fake_get_dispute(_dispute_id):
        status = next(polls)
        offer = None
        if status == "counter_offer":
            offer = {
                "amount_usd": 6.59,
                "message": "We can offer a one-time courtesy credit of $6.59.",
                "expires_at": "2026-09-10T09:20:04Z",
            }
        return {
            "dispute_id": "dsp_step_test",
            "status": status,
            "requested_amount_usd": 10.99,
            "updated_at": "2026-09-03T09:20:04Z",
            "offer": offer,
            "resolution": None,
        }

    monkeypatch.setattr(orchestrator, "analyze_charge", lambda **_k: analysis)
    monkeypatch.setattr(orchestrator, "gather_evidence", lambda **_k: evidence)
    monkeypatch.setattr(orchestrator, "prepare_dispute", lambda **_k: dispute)
    monkeypatch.setattr(
        orchestrator,
        "submit_dispute",
        lambda _dispute: {
            "dispute_id": "dsp_step_test",
            "status": "submitted",
            "requested_amount_usd": 10.99,
            "offer": None,
            "resolution": None,
        },
    )
    monkeypatch.setattr(orchestrator, "get_dispute", fake_get_dispute)
    monkeypatch.setattr(
        orchestrator, "evaluate_counter_offer", lambda **_k: negotiation
    )


async def drain(client, case_id, limit=10):
    """Advance the case until it finishes, returning the last response body."""
    body = None
    for _ in range(limit):
        response = await client.post(f"/cases/{case_id}/advance")
        assert response.status_code == 200
        body = response.json()
        if body["done"]:
            return body
    raise AssertionError("Case did not finish within the advance limit")


async def test_started_case_is_empty_but_valid(monkeypatch):
    stub_agents(monkeypatch, [])

    async with backend_client() as client:
        response = await client.post(
            "/cases/start", json={"transaction_id": "txn_0035"}
        )

        assert response.status_code == 201
        case = response.json()
        assert case["status"] == "analyzing"
        assert case["timeline"] == []
        assert case["transaction"]["transaction_id"] == "txn_0035"
        # Internal bookkeeping never reaches the client.
        assert "_state" not in case


async def test_timeline_grows_one_event_per_advance(monkeypatch):
    stub_agents(monkeypatch, ["under_review", "counter_offer"])

    async with backend_client() as client:
        case_id = (
            await client.post("/cases/start", json={"transaction_id": "txn_0035"})
        ).json()["case_id"]

        lengths = []
        for _ in range(10):
            body = (await client.post(f"/cases/{case_id}/advance")).json()
            lengths.append(len(body["case"]["timeline"]))
            if body["done"]:
                break

        assert lengths == [1, 2, 3, 4, 5, 6]

        final = body["case"]
        assert [event["event"] for event in final["timeline"]] == [
            "anomaly_detected",
            "evidence_gathered",
            "dispute_filed",
            "merchant_reviewing",
            "merchant_response",
            "negotiation_evaluated",
        ]
        assert final["case_id"] == case_id
        assert final["status"] == "awaiting_human"
        assert final["decision"]["required"] is True


async def test_merchant_poll_asks_caller_to_retry(monkeypatch):
    stub_agents(monkeypatch, ["under_review", "under_review", "counter_offer"])

    async with backend_client() as client:
        case_id = (
            await client.post("/cases/start", json={"transaction_id": "txn_0035"})
        ).json()["case_id"]

        retries = []
        for _ in range(10):
            body = (await client.post(f"/cases/{case_id}/advance")).json()
            retries.append(body["retry"])
            if body["done"]:
                break

        # Waiting on the merchant is reported, never blocked on server side.
        assert True in retries
        # A repeated merchant status does not duplicate the timeline event.
        events = [event["event"] for event in body["case"]["timeline"]]
        assert events.count("merchant_reviewing") == 1


async def test_timeline_uses_real_wall_clock(monkeypatch):
    stub_agents(monkeypatch, ["counter_offer"])

    async with backend_client() as client:
        case_id = (
            await client.post("/cases/start", json={"transaction_id": "txn_0035"})
        ).json()["case_id"]

        body = await drain(client, case_id)
        case = body["case"]
        stamps = [event["at"] for event in case["timeline"]]

        # Stamps are "now", not the dataset posted_at that produced the old
        # three-identical-timestamps bug.
        assert all(stamp != case["transaction"]["posted_at"] for stamp in stamps)
        assert stamps == sorted(stamps)
        assert all(stamp.endswith("Z") for stamp in stamps)


async def test_case_id_is_stable_across_advances(monkeypatch):
    stub_agents(monkeypatch, ["counter_offer"])

    async with backend_client() as client:
        case_id = (
            await client.post("/cases/start", json={"transaction_id": "txn_0035"})
        ).json()["case_id"]

        ids = []
        for _ in range(10):
            body = (await client.post(f"/cases/{case_id}/advance")).json()
            ids.append(body["case"]["case_id"])
            if body["done"]:
                break

        # The dispute agent mints its own case_id; ours must win.
        assert set(ids) == {case_id}
        fetched = (await client.get(f"/cases/{case_id}")).json()
        assert fetched["case_id"] == case_id


async def test_advance_is_idempotent_once_finished(monkeypatch):
    stub_agents(monkeypatch, ["counter_offer"])

    async with backend_client() as client:
        case_id = (
            await client.post("/cases/start", json={"transaction_id": "txn_0035"})
        ).json()["case_id"]

        settled = (await drain(client, case_id))["case"]["timeline"]
        again = (await client.post(f"/cases/{case_id}/advance")).json()

        assert again["done"] is True
        assert again["next_step"] is None
        assert again["case"]["timeline"] == settled


async def test_start_rejects_unknown_transaction(monkeypatch):
    stub_agents(monkeypatch, [])

    async with backend_client() as client:
        response = await client.post(
            "/cases/start", json={"transaction_id": "txn_nope"}
        )

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "transaction_not_found"


async def test_advance_reports_failure_without_crashing(monkeypatch):
    from agents import orchestrator

    stub_agents(monkeypatch, [])

    def boom(**_kwargs):
        raise RuntimeError("Bedrock is unavailable")

    monkeypatch.setattr(orchestrator, "analyze_charge", boom)

    async with backend_client() as client:
        case_id = (
            await client.post("/cases/start", json={"transaction_id": "txn_0035"})
        ).json()["case_id"]

        body = (await client.post(f"/cases/{case_id}/advance")).json()

        assert body["done"] is True
        assert body["case"]["status"] == "failed"
        assert body["case"]["timeline"][-1]["event"] == "case_failed"


async def test_advance_rejects_unknown_case(monkeypatch):
    stub_agents(monkeypatch, [])

    async with backend_client() as client:
        response = await client.post("/cases/case_missing/advance")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "case_not_found"

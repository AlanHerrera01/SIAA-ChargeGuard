"""
ChargeGuard Backend FastAPI Application

Main entry point for the ChargeGuard backend API.
Integrates with orchestrator to handle charge analysis and dispute workflow.
"""

import os
import sys
import json
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Add project root to path for imports
project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)


from agents.orchestrator import (
    advance_case_state,
    case_state_result,
    create_case_state,
    run_chargeguard_case,
)
from backend.schemas import (
    CaseAdvanceResponse,
    CaseDetail,
    CaseListResponse,
    CaseSummary,
    DecisionResolutionResponse,
    PendingDecisionListResponse,
)
from backend.storage import create_state_stores


logger = logging.getLogger(__name__)


# Initialize FastAPI app
app = FastAPI(
    title="ChargeGuard Backend API",
    description="API for autonomous charge dispute monitoring and management",
    version="0.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class CaseAnalysisRequest(BaseModel):
    """Request model for analyzing a charge"""
    transaction_id: str


class CaseDecisionRequest(BaseModel):
    """Request model for user decision on a case"""
    decision: Literal["accept_offer", "reject_and_request_full_refund"]


class BankTransaction(BaseModel):
    """Canonical transaction embedded in a Mock Bank event."""

    model_config = ConfigDict(extra="forbid")

    transaction_id: str = Field(pattern=r"^txn_.+")
    user_id: str
    subscription_id: str
    merchant_id: str
    merchant_name: str
    amount_usd: float = Field(gt=0, allow_inf_nan=False)
    currency: Literal["USD"]
    posted_at: str
    description: str
    status: Literal["posted"]
    invoice_key: str

    @field_validator("posted_at")
    @classmethod
    def validate_posted_at(cls, value: str) -> str:
        validate_utc_timestamp(value, "posted_at")
        return value


class TransactionPostedEvent(BaseModel):
    """Envelope sent by Mock Bank for a posted transaction."""

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(pattern=r"^evt_.+")
    event_type: Literal["transaction.posted"]
    occurred_at: str
    data: BankTransaction

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, value: str) -> str:
        validate_utc_timestamp(value, "occurred_at")
        return value

    @model_validator(mode="after")
    def validate_event_clock(self):
        if self.occurred_at != self.data.posted_at:
            raise ValueError("occurred_at must match data.posted_at")
        return self


class DecisionResolutionRequest(BaseModel):
    """Human decision for a merchant counter-offer."""
    decision: Literal["accept_offer", "reject_and_request_full_refund"]
    reason: str | None = None


# Data loading (cached)
TRANSACTIONS = None
SUBSCRIPTIONS = None
MERCHANTS = None
CASES, PENDING_DECISIONS, EVENTS = create_state_stores()
TERMINAL_MERCHANT_STATUSES = {
    "resolved_accepted",
    "resolved_full",
    "denied",
}
REJECTION_TERMINAL_STATUSES = {"resolved_full", "denied"}
MERCHANT_POLL_MAX_ATTEMPTS = int(os.getenv("MERCHANT_POLL_MAX_ATTEMPTS", "10"))
MERCHANT_POLL_INTERVAL_SECONDS = float(
    os.getenv("MERCHANT_POLL_INTERVAL_SECONDS", "1")
)


class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def validate_utc_timestamp(value: str, field_name: str) -> None:
    if not value.endswith("Z") or "T" not in value:
        raise ValueError(f"{field_name} must be an ISO-8601 UTC timestamp ending in Z")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a valid ISO-8601 timestamp") from exc


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def merchant_api_url() -> str:
    """Resolve the merchant API URL, preserving the old variable temporarily."""
    return (
        os.getenv("MERCHANT_API_URL")
        or os.getenv("MOCK_MERCHANT_URL")
        or "http://127.0.0.1:8002"
    ).rstrip("/")


@app.exception_handler(APIError)
async def api_error_handler(_request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_body("validation_error", "Request validation failed"),
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_request: Request, exc: HTTPException):
    code = {
        404: "not_found",
        405: "method_not_allowed",
    }.get(exc.status_code, "http_error")
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, str(exc.detail)),
    )


def load_datasets():
    """Load dataset files once at startup"""
    global TRANSACTIONS, SUBSCRIPTIONS, MERCHANTS
    
    datasets_dir = Path(project_root) / "datasets"
    
    try:
        with open(datasets_dir / "transactions.json") as f:
            TRANSACTIONS = json.load(f)
    except Exception as e:
        print(f"Warning: Could not load transactions.json: {e}")
        TRANSACTIONS = {}
    
    try:
        with open(datasets_dir / "subscriptions.json") as f:
            SUBSCRIPTIONS = json.load(f)
    except Exception as e:
        print(f"Warning: Could not load subscriptions.json: {e}")
        SUBSCRIPTIONS = {}
    
    try:
        with open(datasets_dir / "merchants.json") as f:
            MERCHANTS = json.load(f)
    except Exception as e:
        print(f"Warning: Could not load merchants.json: {e}")
        MERCHANTS = {}


def dataset_items(dataset):
    """Return records for either a JSON array or a wrapped object."""
    if isinstance(dataset, list):
        return dataset
    return next(iter(dataset.values()), []) if isinstance(dataset, dict) else []


def to_dict(value):
    """Convert Pydantic models and plain objects into JSON-safe dictionaries."""
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value.__dict__ if hasattr(value, "__dict__") else value


def transaction_exists(transaction_id: str) -> bool:
    return any(
        tx.get("transaction_id", tx.get("id")) == transaction_id
        for tx in dataset_items(TRANSACTIONS)
    )


def find_transaction(transaction_id: str) -> dict | None:
    return next(
        (
            transaction
            for transaction in dataset_items(TRANSACTIONS)
            if transaction.get("transaction_id", transaction.get("id"))
            == transaction_id
        ),
        None,
    )


def validate_webhook_transaction(received: BankTransaction) -> None:
    canonical = find_transaction(received.transaction_id)
    if canonical is None:
        raise APIError(404, "transaction_not_found", "Transaction not found")

    critical_fields = (
        "transaction_id",
        "user_id",
        "subscription_id",
        "merchant_id",
        "amount_usd",
        "currency",
        "posted_at",
    )
    received_data = received.model_dump(mode="json")
    if any(received_data[field] != canonical.get(field) for field in critical_fields):
        raise APIError(
            409,
            "transaction_payload_mismatch",
            "Webhook transaction does not match the canonical transaction",
        )


def public_event(event: dict) -> dict:
    return {key: value for key, value in event.items() if key != "payload"}


def find_subscription(subscription_id: str) -> dict | None:
    return next(
        (
            subscription
            for subscription in dataset_items(SUBSCRIPTIONS)
            if subscription.get("subscription_id") == subscription_id
        ),
        None,
    )


def find_merchant(merchant_id: str) -> dict | None:
    return next(
        (
            merchant
            for merchant in dataset_items(MERCHANTS)
            if merchant.get("merchant_id") == merchant_id
        ),
        None,
    )


def public_case_status(analysis: dict | None, merchant_response: dict | None) -> str:
    if analysis and analysis.get("is_anomaly") is False:
        return "dismissed"
    merchant_status = merchant_response.get("status") if merchant_response else None
    if merchant_status == "counter_offer":
        return "awaiting_human"
    if merchant_status in {"submitted", "under_review", "escalated"}:
        return "awaiting_merchant"
    if merchant_status in TERMINAL_MERCHANT_STATUSES:
        return "resolved"
    return "analyzed"


def public_evidence(dispute: dict | None) -> list[dict]:
    if not dispute:
        return []
    return [
        {
            "type": item["type"],
            "uri": item.get("uri"),
            "description": item["description"],
        }
        for item in dispute.get("evidence", [])
    ]


def public_timeline(
    transaction: dict,
    analysis: dict | None,
    dispute: dict | None,
    merchant_response: dict | None,
    evidence_summary: str | None,
) -> list[dict]:
    created_at = transaction["posted_at"]
    timeline = [
        {
            "at": created_at,
            "actor": "chargeguard",
            "event": "anomaly_detected" if analysis and analysis.get("is_anomaly") else "transaction_analyzed",
            "detail": analysis.get("reason", "Transaction analyzed by ChargeGuard.") if analysis else "Transaction analyzed by ChargeGuard.",
        }
    ]
    if evidence_summary:
        timeline.append(
            {
                "at": created_at,
                "actor": "chargeguard",
                "event": "evidence_gathered",
                "detail": evidence_summary,
            }
        )
    if dispute:
        timeline.append(
            {
                "at": created_at,
                "actor": "chargeguard",
                "event": "dispute_filed",
                "detail": dispute["message"],
            }
        )
    if merchant_response:
        offer = merchant_response.get("offer") or {}
        timeline.append(
            {
                "at": merchant_response.get("updated_at", created_at),
                "actor": "merchant_api",
                "event": "merchant_response",
                "detail": offer.get("message") or merchant_response["status"],
            }
        )
    return timeline


def now_iso() -> str:
    """Wall-clock UTC timestamp used to stamp timeline events as they happen."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def stamp_events(events: list[dict]) -> list[dict]:
    """Attach the real time of occurrence to freshly emitted agent events."""
    at = now_iso()
    return [{"at": at, **event} for event in events]


def public_case(case: dict) -> dict:
    """Hide internal bookkeeping (``_state``) from API consumers."""
    return {key: value for key, value in case.items() if not key.startswith("_")}


def serialize_case(
    transaction_id: str,
    result: dict,
    timeline: list[dict] | None = None,
    case_id: str | None = None,
) -> dict:
    """Store the public CaseDetail shape guaranteed for frontend consumers."""
    dispute = to_dict(result.get("dispute")) if result.get("dispute") else None
    merchant_response = to_dict(result.get("merchant_response"))
    analysis = to_dict(result.get("charge_analysis"))
    evidence = to_dict(result.get("evidence"))
    negotiation = to_dict(result.get("negotiation"))
    transaction = find_transaction(transaction_id)
    if transaction is None:
        raise APIError(404, "transaction_not_found", "Transaction not found")

    merchant = find_merchant(transaction["merchant_id"])
    merchant_name = transaction.get("merchant_name") or (
        merchant.get("name") if merchant else transaction["merchant_id"]
    )
    case_id = (
        case_id
        or (dispute.get("case_id") if dispute else None)
        or f"case_{uuid4().hex[:8]}"
    )
    status = public_case_status(analysis, merchant_response)
    created_at = (
        merchant_response.get("created_at")
        if isinstance(merchant_response, dict)
        else None
    ) or transaction["posted_at"]
    updated_at = (
        merchant_response.get("updated_at")
        if isinstance(merchant_response, dict)
        else None
    ) or created_at
    recommendation = negotiation.get("recommendation") if negotiation else None
    if recommendation not in {"accept_offer", "reject_and_request_full_refund"}:
        recommendation = "reject_and_request_full_refund" if status == "awaiting_human" else None
    reason = (
        negotiation.get("rationale")
        or negotiation.get("reason")
        if negotiation
        else None
    )

    case = CaseDetail(
        case_id=case_id,
        transaction={
            "transaction_id": transaction["transaction_id"],
            "subscription_id": transaction["subscription_id"],
            "merchant_id": transaction["merchant_id"],
            "merchant_name": merchant_name,
            "amount_usd": transaction["amount_usd"],
            "currency": transaction["currency"],
            "posted_at": transaction["posted_at"],
            "description": transaction["description"],
        },
        anomaly={
            "is_anomaly": bool(analysis and analysis.get("is_anomaly")),
            "type": analysis.get("type", "NONE") if analysis else "NONE",
            "expected_amount_usd": analysis.get("expected_amount", 0) if analysis else 0,
            "actual_amount_usd": analysis.get("actual_amount", transaction["amount_usd"]) if analysis else transaction["amount_usd"],
            "claimed_amount_usd": analysis.get("difference", 0) if analysis else 0,
            "confidence": analysis.get("confidence", 0) if analysis else 0,
            "reason": analysis.get("reason", "Transaction analyzed by ChargeGuard.") if analysis else "Transaction analyzed by ChargeGuard.",
        },
        evidence=public_evidence(dispute),
        dispute={
            "dispute_id": merchant_response.get("dispute_id") if merchant_response else None,
            "claim_type": dispute.get("claim_type", "other") if dispute else "other",
            "requested_amount_usd": dispute.get("requested_amount_usd", 0) if dispute else 0,
            "message": dispute.get("message", "") if dispute else "",
        }
        if dispute
        else None,
        merchant={
            "status": merchant_response.get("status") if merchant_response else None,
            "offer": merchant_response.get("offer") if merchant_response else None,
            "resolution": merchant_response.get("resolution") if merchant_response else None,
        },
        decision={
            "required": status == "awaiting_human",
            "recommendation": recommendation,
            "reason": reason,
        },
        status=status,
        timeline=timeline
        if timeline is not None
        else public_timeline(
            transaction,
            analysis,
            dispute,
            merchant_response,
            evidence.get("summary") if evidence else None,
        ),
        created_at=created_at,
        updated_at=updated_at,
    ).model_dump(mode="json")
    if status == "awaiting_human":
        offer = merchant_response.get("offer") if merchant_response else None
        PENDING_DECISIONS[case_id] = {
            "case_id": case_id,
            "dispute_id": merchant_response.get("dispute_id"),
            "merchant_name": merchant_name,
            "requested_amount_usd": dispute.get("requested_amount_usd"),
            "offered_amount_usd": offer.get("amount_usd") if offer else 0,
            "currency": transaction["currency"],
            "recommendation": recommendation or "reject_and_request_full_refund",
            "reason": reason or "The evidence supports the full refund.",
            "status": "pending",
        }
    CASES[case_id] = case
    return case


def process_transaction(transaction_id: str) -> dict:
    """Run the synchronous agent workflow and persist its API representation."""
    result = run_chargeguard_case(transaction_id)
    return serialize_case(transaction_id, result)


def store_stepped_case(
    case_id: str,
    state: dict,
    timeline: list[dict],
    created_at: str,
) -> dict:
    """Persist one snapshot of an in-flight case, keeping its identity stable."""
    case = serialize_case(
        state["transaction_id"],
        case_state_result(state),
        timeline=timeline,
        case_id=case_id,
    )
    case["created_at"] = created_at
    case["updated_at"] = now_iso()

    if not state["done"] and case["status"] == "analyzed":
        case["status"] = "analyzing"

    case["_state"] = state
    CASES[case_id] = case
    return case


def start_stepped_case(transaction_id: str) -> dict:
    """Create an empty case up front so the UI has something to show at once."""
    state = create_case_state(transaction_id)
    case_id = f"case_{uuid4().hex[:8]}"
    return store_stepped_case(case_id, state, [], now_iso())


def advance_stepped_case(case: dict) -> dict:
    """Run exactly one agent step and fold its events into the timeline."""
    state = case.get("_state")
    if state is None:
        raise APIError(
            409,
            "case_not_steppable",
            "Case was not created through the stepped workflow",
        )
    if state.get("done"):
        return case

    case_id = case["case_id"]
    try:
        state, events = advance_case_state(state)
    except Exception:
        logger.exception("Failed to advance case %s", case_id)
        state["done"] = True
        state["step"] = None
        state["retry"] = False
        failed = store_stepped_case(
            case_id,
            state,
            case["timeline"]
            + stamp_events(
                [
                    {
                        "actor": "system",
                        "event": "case_failed",
                        "detail": "Transaction analysis could not be completed",
                    }
                ]
            ),
            case["created_at"],
        )
        failed["status"] = "failed"
        CASES[case_id] = failed
        return failed

    return store_stepped_case(
        case_id,
        state,
        case["timeline"] + stamp_events(events),
        case["created_at"],
    )


def process_event(event_id: str) -> None:
    """Process an accepted bank event in FastAPI's background thread pool."""
    event = EVENTS.get(event_id)
    if event is None:
        return

    event["status"] = "processing"
    EVENTS[event_id] = event
    try:
        case = process_transaction(event["transaction_id"])
    except Exception:
        logger.exception("Failed to process bank event %s", event_id)
        event["status"] = "failed"
        event["error"] = error_body(
            "case_processing_failed",
            "Transaction analysis could not be completed",
        )["error"]
        EVENTS[event_id] = event
        return

    event["status"] = "completed"
    event["case_id"] = case["case_id"]
    EVENTS[event_id] = event


def require_case(case_id: str) -> dict:
    case = CASES.get(case_id)
    if case is None:
        raise APIError(404, "case_not_found", "Case not found")
    return case


def summarize_case(case: dict) -> dict:
    return CaseSummary(
        case_id=case["case_id"],
        transaction_id=case["transaction"]["transaction_id"],
        merchant_id=case["transaction"]["merchant_id"],
        merchant_name=case["transaction"]["merchant_name"],
        anomaly_type=case["anomaly"]["type"],
        claimed_amount_usd=case["anomaly"]["claimed_amount_usd"],
        currency=case["transaction"]["currency"],
        status=case["status"],
        created_at=case["created_at"],
        updated_at=case["updated_at"],
    ).model_dump(mode="json")


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ChargeGuard Backend API",
        "version": "0.1.0",
    }


# Data access endpoints
@app.get("/transactions")
async def get_transactions():
    """Get all transactions from dataset"""
    if TRANSACTIONS is None:
        raise APIError(500, "dataset_not_loaded", "Transactions data not loaded")
    return TRANSACTIONS


@app.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    """Get a specific transaction by ID"""
    if TRANSACTIONS is None:
        raise APIError(500, "dataset_not_loaded", "Transactions data not loaded")
    
    tx_list = dataset_items(TRANSACTIONS)
    transaction = next(
        (
            tx for tx in tx_list
            if tx.get("transaction_id", tx.get("id")) == transaction_id
        ),
        None,
    )
    
    if not transaction:
        raise APIError(404, "transaction_not_found", "Transaction not found")
    
    return transaction


@app.get("/subscriptions")
async def get_subscriptions():
    """Get all subscriptions from dataset"""
    if SUBSCRIPTIONS is None:
        raise APIError(500, "dataset_not_loaded", "Subscriptions data not loaded")
    return SUBSCRIPTIONS


@app.get("/subscriptions/{subscription_id}")
async def get_subscription(subscription_id: str):
    """Get a specific subscription by ID"""
    if SUBSCRIPTIONS is None:
        raise APIError(500, "dataset_not_loaded", "Subscriptions data not loaded")
    
    sub_list = dataset_items(SUBSCRIPTIONS)
    subscription = next(
        (
            sub for sub in sub_list
            if sub.get("subscription_id", sub.get("id")) == subscription_id
        ),
        None,
    )
    
    if not subscription:
        raise APIError(404, "subscription_not_found", "Subscription not found")
    
    return subscription


@app.get("/merchants")
async def get_merchants():
    """Get all merchants from dataset"""
    if MERCHANTS is None:
        raise APIError(500, "dataset_not_loaded", "Merchants data not loaded")
    return MERCHANTS


# Case analysis endpoint - main workflow
@app.post("/cases/analyze", response_model=CaseDetail)
async def analyze_case(request: CaseAnalysisRequest):
    """
    Analyze a charge and run the ChargeGuard workflow.
    
    This is the main endpoint that:
    1. Runs ChargeAnalysisAgent to classify the anomaly
    2. Gathers evidence deterministically
    3. Drafts dispute message with DisputeAgent
    4. Submits to Mock Merchant
    5. Polls for response
    6. Returns merchant response and next steps
    
    For hackathon: runs synchronously until merchant reaches counter_offer/resolved
    """
    transaction_id = request.transaction_id
    
    try:
        if not transaction_exists(transaction_id):
            raise APIError(404, "transaction_not_found", "Transaction not found")

        # Run the orchestrator (blocks until merchant decision)
        return process_transaction(transaction_id)
    
    except APIError:
        raise
    except (StopIteration, ValueError) as e:
        raise APIError(404, "transaction_not_found", str(e))
    except Exception as e:
        raise APIError(500, "case_processing_failed", f"Case analysis failed: {str(e)}")


@app.post("/cases/start", response_model=CaseDetail, status_code=201)
async def start_case(request: CaseAnalysisRequest):
    """Create a case immediately, before any agent has run.

    The UI navigates to the case right away and then drives it forward with
    ``POST /cases/{case_id}/advance``, so every step appears as it happens.
    """
    if not transaction_exists(request.transaction_id):
        raise APIError(404, "transaction_not_found", "Transaction not found")

    return public_case(start_stepped_case(request.transaction_id))


@app.post("/cases/{case_id}/advance", response_model=CaseAdvanceResponse)
async def advance_case(case_id: str):
    """Run the next pending agent step and return the updated case."""
    case = advance_stepped_case(require_case(case_id))
    state = case.get("_state") or {}

    return {
        "case": public_case(case),
        "done": bool(state.get("done")),
        "retry": bool(state.get("retry")),
        "next_step": state.get("step"),
    }


@app.post("/transactions/webhook", status_code=202)
async def transaction_webhook(
    request: TransactionPostedEvent,
    background_tasks: BackgroundTasks,
):
    """Receive a bank event and start analysis in the background."""
    validate_webhook_transaction(request.data)
    payload = request.model_dump(mode="json")

    existing = EVENTS.get(request.event_id)
    if existing is not None:
        if existing["payload"] != payload:
            raise APIError(
                409,
                "event_payload_conflict",
                "Event ID was previously received with different data",
            )
        return {
            "status": existing["status"],
            "event_id": request.event_id,
            "transaction_id": request.data.transaction_id,
            "duplicate": True,
        }

    new_event = {
        "event_id": request.event_id,
        "event_type": request.event_type,
        "occurred_at": request.occurred_at,
        "transaction_id": request.data.transaction_id,
        "status": "accepted",
        "case_id": None,
        "error": None,
        "payload": payload,
        "created_at": request.occurred_at,
    }
    put_if_absent = getattr(EVENTS, "put_if_absent", None)
    if put_if_absent and not put_if_absent(request.event_id, new_event):
        existing = EVENTS.get(request.event_id)
        if existing and existing["payload"] != payload:
            raise APIError(409, "event_payload_conflict", "Event ID already used")
        return {
            "status": existing["status"],
            "event_id": request.event_id,
            "transaction_id": request.data.transaction_id,
            "duplicate": True,
        }
    if not put_if_absent:
        EVENTS[request.event_id] = new_event
    background_tasks.add_task(process_event, request.event_id)
    return {
        "status": "accepted",
        "event_id": request.event_id,
        "event_type": request.event_type,
        "transaction_id": request.data.transaction_id,
        "duplicate": False,
    }


@app.get("/events")
async def list_events():
    """List bank events received by the backend."""
    return [public_event(event) for event in EVENTS.values()]


@app.get("/events/{event_id}")
async def get_event(event_id: str):
    """Return the processing state of an accepted bank event."""
    event = EVENTS.get(event_id)
    if event is None:
        raise APIError(
            404,
            "event_not_found",
            "Event not found",
        )
    return public_event(event)


@app.get("/cases", response_model=CaseListResponse)
async def list_cases():
    """List cases created by the backend."""
    return {"items": [summarize_case(case) for case in CASES.values()]}


# Case status endpoint
@app.get("/cases/{case_id}", response_model=CaseDetail)
async def get_case_status(case_id: str):
    """Get status of an existing case."""
    return public_case(require_case(case_id))


@app.get("/decisions/pending", response_model=PendingDecisionListResponse)
async def list_pending_decisions():
    """List counter-offers waiting for the user."""
    return {"items": list(PENDING_DECISIONS.values())}


async def merchant_request(
    method: str,
    path: str,
    payload: dict | None = None,
) -> dict:
    """Send one bounded request to Mock Merchant and normalize failures."""
    transport = getattr(app.state, "merchant_transport", None)
    try:
        async with httpx.AsyncClient(timeout=10.0, transport=transport) as client:
            response = await client.request(
                method,
                f"{merchant_api_url()}{path}",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Merchant request failed: %s %s", method, path)
        raise APIError(
            502,
            "merchant_service_unavailable",
            "Merchant service is unavailable",
        ) from exc

    if not isinstance(result, dict) or not isinstance(result.get("status"), str):
        raise APIError(
            502,
            "invalid_merchant_response",
            "Merchant returned an invalid response",
        )
    return result


async def wait_for_merchant_resolution(
    dispute_id: str,
    max_attempts: int | None = None,
    interval_seconds: float | None = None,
) -> dict | None:
    """Poll an escalated dispute until it becomes terminal or times out."""
    attempts = max_attempts or MERCHANT_POLL_MAX_ATTEMPTS
    interval = (
        MERCHANT_POLL_INTERVAL_SECONDS
        if interval_seconds is None
        else interval_seconds
    )
    for attempt in range(attempts):
        response = await merchant_request("GET", f"/disputes/{dispute_id}")
        status = response["status"]
        if status in REJECTION_TERMINAL_STATUSES:
            return response
        if status != "escalated":
            raise APIError(
                502,
                "unexpected_merchant_status",
                "Merchant returned an unexpected dispute status",
            )
        if attempt + 1 < attempts:
            await asyncio.sleep(interval)
    return None


def record_user_decision(
    case: dict,
    request: DecisionResolutionRequest,
    merchant_response: dict,
) -> None:
    case["merchant"] = {
        "status": merchant_response.get("status"),
        "offer": merchant_response.get("offer"),
        "resolution": merchant_response.get("resolution"),
    }
    case["decision"] = {
        "required": False,
        "recommendation": request.decision,
        "reason": request.reason,
    }
    case["updated_at"] = merchant_response.get("updated_at", case["updated_at"])
    case["timeline"].append(
        {
            "at": case["updated_at"],
            "actor": "user",
            "event": "decision_resolved",
            "detail": request.decision,
        }
    )
    PENDING_DECISIONS.pop(case["case_id"], None)
    CASES[case["case_id"]] = case


async def resolve_merchant_decision(
    case: dict,
    request: DecisionResolutionRequest,
) -> dict:
    if request.decision not in {
        "accept_offer",
        "reject_and_request_full_refund",
    }:
        raise APIError(400, "unsupported_decision", "Unsupported decision")

    dispute_id = case.get("dispute", {}).get("dispute_id") if case.get("dispute") else None
    if not dispute_id:
        raise APIError(409, "missing_dispute", "Case has no merchant dispute")

    endpoint = "accept"
    payload = None
    if request.decision == "reject_and_request_full_refund":
        endpoint = "reject"
        payload = {"reason": request.reason or "User requested full refund"}

    merchant_response = await merchant_request(
        "POST",
        f"/disputes/{dispute_id}/{endpoint}",
        payload,
    )
    status = merchant_response["status"]
    if request.decision == "accept_offer" and status != "resolved_accepted":
        raise APIError(
            502,
            "unexpected_merchant_status",
            "Merchant returned an unexpected dispute status",
        )
    if (
        request.decision == "reject_and_request_full_refund"
        and status not in REJECTION_TERMINAL_STATUSES | {"escalated"}
    ):
        raise APIError(
            502,
            "unexpected_merchant_status",
            "Merchant returned an unexpected dispute status",
        )

    record_user_decision(case, request, merchant_response)

    if status in TERMINAL_MERCHANT_STATUSES:
        case["status"] = "resolved"
        CASES[case["case_id"]] = case
        return case

    case["status"] = "awaiting_merchant"
    CASES[case["case_id"]] = case
    final_response = await wait_for_merchant_resolution(dispute_id)
    if final_response is None:
        return case

    case["merchant"] = {
        "status": final_response.get("status"),
        "offer": final_response.get("offer"),
        "resolution": final_response.get("resolution"),
    }
    case["updated_at"] = final_response.get("updated_at", case["updated_at"])
    case["status"] = "resolved"
    CASES[case["case_id"]] = case
    return case


@app.post("/decisions/{case_id}/resolve", response_model=DecisionResolutionResponse)
async def resolve_decision(
    case_id: str,
    request: DecisionResolutionRequest,
):
    """Apply the user's decision to the corresponding merchant dispute."""
    case = await resolve_merchant_decision(require_case(case_id), request)
    return {
        "case_id": case["case_id"],
        "decision": request.decision,
        "case_status": case["status"],
        "merchant_status": case["merchant"]["status"],
        "resolution": case["merchant"]["resolution"],
    }


# Case decision endpoint
@app.post("/cases/{case_id}/decision")
async def submit_case_decision(case_id: str, request: CaseDecisionRequest):
    """
    Submit user decision on a case (accept/reject counter-offer).
    
    Note: For hackathon MVP, decisions are made during the analyze call.
    Future: support async workflow with separate decision endpoint.
    """
    return public_case(
        await resolve_merchant_decision(
            require_case(case_id),
            DecisionResolutionRequest(decision=request.decision),
        )
    )


@app.post("/demo/reset")
async def reset_demo():
    """Clear workflow state and reload the synthetic datasets."""
    CASES.clear()
    PENDING_DECISIONS.clear()
    EVENTS.clear()
    load_datasets()
    return {
        "status": "ok",
        "message": "Backend events, cases and pending decisions cleared",
    }


# Startup event
@app.on_event("startup")
async def startup_event():
    """Load datasets on startup"""
    load_datasets()
    print("✅ ChargeGuard Backend API started")
    print("📊 Datasets loaded successfully")


try:
    from mangum import Mangum
except ImportError:
    if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        raise RuntimeError("Mangum is required when running in AWS Lambda")
    handler = None
else:
    handler = Mangum(app)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "service": "ChargeGuard Backend API",
        "version": "0.1.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze_case": "POST /cases/analyze",
            "start_case": "POST /cases/start",
            "advance_case": "POST /cases/{case_id}/advance",
            "webhook": "POST /transactions/webhook",
            "events": "GET /events",
            "event_status": "GET /events/{event_id}",
            "cases": "GET /cases",
            "pending_decisions": "GET /decisions/pending",
            "resolve_decision": "POST /decisions/{case_id}/resolve",
            "reset": "POST /demo/reset",
            "transactions": "GET /transactions",
            "subscriptions": "GET /subscriptions",
            "merchants": "GET /merchants",
        },
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("BACKEND_PORT", "8000"))
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    
    print(f"🚀 Starting ChargeGuard Backend on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

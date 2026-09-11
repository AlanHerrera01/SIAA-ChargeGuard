from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


CaseStatus = Literal[
    "analyzing",
    "analyzed",
    "awaiting_merchant",
    "awaiting_human",
    "resolved",
    "dismissed",
    "failed",
]
AnomalyType = Literal[
    "PRICE_INCREASE",
    "DUPLICATE_CHARGE",
    "POST_CANCELLATION",
    "NONE",
]
ClaimType = Literal[
    "price_hike",
    "duplicate_charge",
    "charge_after_cancellation",
    "other",
]
MerchantStatus = Literal[
    "submitted",
    "under_review",
    "counter_offer",
    "resolved_accepted",
    "escalated",
    "resolved_full",
    "denied",
]
DecisionValue = Literal["accept_offer", "reject_and_request_full_refund"]


class ErrorEnvelope(Model):
    error: dict[str, str]


class ListResponse(Model):
    items: list


class CaseSummary(Model):
    case_id: str
    transaction_id: str
    merchant_id: str
    merchant_name: str
    anomaly_type: AnomalyType
    claimed_amount_usd: float = Field(ge=0)
    currency: Literal["USD"]
    status: CaseStatus
    created_at: str
    updated_at: str


class CaseListResponse(Model):
    items: list[CaseSummary]


class PublicTransaction(Model):
    transaction_id: str
    subscription_id: str
    merchant_id: str
    merchant_name: str
    amount_usd: float = Field(gt=0)
    currency: Literal["USD"]
    posted_at: str
    description: str


class CaseAnomaly(Model):
    is_anomaly: bool
    type: AnomalyType
    expected_amount_usd: float = Field(ge=0)
    actual_amount_usd: float = Field(ge=0)
    claimed_amount_usd: float = Field(ge=0)
    confidence: float = Field(ge=0, le=1)
    reason: str


class EvidenceItem(Model):
    type: Literal[
        "invoice",
        "email",
        "transaction_history",
        "subscription_terms",
        "other",
    ]
    uri: str | None
    description: str


class PublicDispute(Model):
    dispute_id: str | None
    claim_type: ClaimType
    requested_amount_usd: float = Field(ge=0)
    message: str


class MerchantOffer(Model):
    amount_usd: float = Field(ge=0)
    message: str
    expires_at: str


class MerchantResolution(Model):
    outcome: Literal["accepted", "full_refund", "denied"]
    refund_amount_usd: float = Field(ge=0)
    refund_eta_days: int = Field(ge=0)
    closed_at: str


class PublicMerchantResponse(Model):
    status: MerchantStatus | None
    offer: MerchantOffer | None
    resolution: MerchantResolution | None


class PublicDecision(Model):
    required: bool
    recommendation: DecisionValue | None
    reason: str | None


class TimelineEvent(Model):
    at: str
    actor: Literal["chargeguard", "merchant_api", "user", "system"]
    event: str
    detail: str


class CaseDetail(Model):
    case_id: str
    transaction: PublicTransaction
    anomaly: CaseAnomaly
    evidence: list[EvidenceItem]
    dispute: PublicDispute | None
    merchant: PublicMerchantResponse
    decision: PublicDecision
    status: CaseStatus
    timeline: list[TimelineEvent]
    created_at: str
    updated_at: str


class CaseAdvanceResponse(Model):
    case: CaseDetail
    done: bool
    retry: bool
    next_step: Literal[
        "analyze",
        "evidence",
        "dispute",
        "merchant",
        "negotiate",
    ] | None


class PendingDecision(Model):
    case_id: str
    dispute_id: str
    merchant_name: str
    requested_amount_usd: float = Field(ge=0)
    offered_amount_usd: float = Field(ge=0)
    currency: Literal["USD"]
    recommendation: DecisionValue
    reason: str
    status: Literal["pending"]


class PendingDecisionListResponse(Model):
    items: list[PendingDecision]


class DecisionResolutionResponse(Model):
    case_id: str
    decision: DecisionValue
    case_status: CaseStatus
    merchant_status: MerchantStatus | None
    resolution: MerchantResolution | None

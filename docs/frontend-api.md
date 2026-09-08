# Frontend API Contract

This document freezes the public JSON contract consumed by the ChargeGuard
frontend. Backend endpoints should use Pydantic `response_model` declarations
for these shapes.

## Public Case Status

Allowed values:

- `analyzed`
- `awaiting_merchant`
- `awaiting_human`
- `resolved`
- `dismissed`
- `failed`

## `GET /cases`

Returns summaries only.

```json
{
  "items": [
    {
      "case_id": "case_a1b2c3d4",
      "transaction_id": "txn_0031",
      "merchant_id": "mrc_netflix",
      "merchant_name": "Netflix",
      "anomaly_type": "PRICE_INCREASE",
      "claimed_amount_usd": 4.5,
      "currency": "USD",
      "status": "awaiting_human",
      "created_at": "2026-09-14T09:10:00Z",
      "updated_at": "2026-09-14T09:10:04Z"
    }
  ]
}
```

## `GET /cases/{case_id}`

Returns full detail for a single case. `POST /cases/analyze` returns the same
shape after creating or updating a case.

```json
{
  "case_id": "case_a1b2c3d4",
  "transaction": {
    "transaction_id": "txn_0031",
    "subscription_id": "sub_001",
    "merchant_id": "mrc_netflix",
    "merchant_name": "Netflix",
    "amount_usd": 19.99,
    "currency": "USD",
    "posted_at": "2026-09-14T09:10:00Z",
    "description": "NETFLIX.COM LOS GATOS CA"
  },
  "anomaly": {
    "is_anomaly": true,
    "type": "PRICE_INCREASE",
    "expected_amount_usd": 15.49,
    "actual_amount_usd": 19.99,
    "claimed_amount_usd": 4.5,
    "confidence": 0.98,
    "reason": "The recurring charge increased."
  },
  "evidence": [
    {
      "type": "invoice",
      "uri": "datasets/invoices/inv_0031.pdf",
      "description": "Current invoice."
    }
  ],
  "dispute": {
    "dispute_id": "dsp_123",
    "claim_type": "price_hike",
    "requested_amount_usd": 4.5,
    "message": "Professional dispute message."
  },
  "merchant": {
    "status": "counter_offer",
    "offer": {
      "amount_usd": 2.7,
      "message": "Courtesy credit.",
      "expires_at": "2026-09-21T09:10:04Z"
    },
    "resolution": null
  },
  "decision": {
    "required": true,
    "recommendation": "reject_and_request_full_refund",
    "reason": "The evidence supports the full refund."
  },
  "status": "awaiting_human",
  "timeline": [
    {
      "at": "2026-09-14T09:10:00Z",
      "actor": "chargeguard",
      "event": "anomaly_detected",
      "detail": "Price increase detected."
    }
  ],
  "created_at": "2026-09-14T09:10:00Z",
  "updated_at": "2026-09-14T09:10:04Z"
}
```

## `GET /decisions/pending`

```json
{
  "items": [
    {
      "case_id": "case_a1b2c3d4",
      "dispute_id": "dsp_123",
      "merchant_name": "Netflix",
      "requested_amount_usd": 4.5,
      "offered_amount_usd": 2.7,
      "currency": "USD",
      "recommendation": "reject_and_request_full_refund",
      "reason": "The evidence supports the full refund.",
      "status": "pending"
    }
  ]
}
```

## `POST /decisions/{case_id}/resolve`

Request:

```json
{
  "decision": "reject_and_request_full_refund",
  "reason": "I want to request the full supported refund."
}
```

Allowed `decision` values:

- `accept_offer`
- `reject_and_request_full_refund`

Response:

```json
{
  "case_id": "case_a1b2c3d4",
  "decision": "reject_and_request_full_refund",
  "case_status": "resolved",
  "merchant_status": "resolved_full",
  "resolution": {
    "outcome": "full_refund",
    "refund_amount_usd": 4.5,
    "refund_eta_days": 5,
    "closed_at": "2026-09-14T09:11:00Z"
  }
}
```

If merchant polling times out:

```json
{
  "case_id": "case_a1b2c3d4",
  "decision": "reject_and_request_full_refund",
  "case_status": "awaiting_merchant",
  "merchant_status": "escalated",
  "resolution": null
}
```

## Error Envelope

All public API errors use:

```json
{
  "error": {
    "code": "case_not_found",
    "message": "Case not found"
  }
}
```

Minimum error codes:

- `validation_error`
- `transaction_not_found`
- `case_not_found`
- `decision_not_found`
- `unsupported_decision`
- `merchant_service_unavailable`
- `case_processing_failed`

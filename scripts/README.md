# Local storage and demo reset (WP-05)

Run from the repository root with Python 3.12 (also tested on host Python 3.11).
Activate a virtual environment, then install:

```bash
python -m pip install -r scripts/requirements-dev.txt
make up
make seed
make seed  # safe to repeat: same primary keys and object keys
python -m pytest scripts --localstack
make demo-reset
```

Make already dispatches `seed` and `demo-reset` to these scripts. If Python is not
on PATH, use `make seed PYTHON=.venv/Scripts/python.exe` on Windows. Without Make,
use `python scripts/seed_local.py` / `python scripts/demo_reset.py`.

## Configuration and AWS real

Scripts read the root `.env` using python-dotenv, then overlay process environment
variables, including explicit empty values. They never execute `.env` as a shell
script. Relative `DATASET_DIR` paths resolve against the repo root.

| Variable | Default / behavior |
|---|---|
| `AWS_ENDPOINT_URL` absent | `http://localhost:4566` |
| `AWS_ENDPOINT_URL` empty | Normal AWS endpoints; no `endpoint_url` argument passed |
| `AWS_REGION` | `AWS_DEFAULT_REGION`, then `us-east-1` |
| `AWS_PROFILE` | Selected AWS profile; ignored for recognized LocalStack endpoints |
| `S3_BUCKET_EVIDENCE` | `chargeguard-evidence` |
| `DATASET_DIR` | `datasets/` under the repo root |
| `MOCK_BANK_URL` | `http://localhost:8001` |
| `MOCK_MERCHANT_URL` | `http://localhost:8002` |

Only `AWS_ENDPOINT_URL` controls SDK endpoints, not legacy `S3_ENDPOINT` or
`DYNAMODB_ENDPOINT`. Table names and keys are exactly those in contracts §4.1;
the seed does not override them with legacy table-name variables. No model is
needed and no Bedrock API is called.

LocalStack uses dummy `test` credentials internally, without resolving AWS
profiles or credentials. Recognized local hosts are localhost, 127.0.0.1, ::1,
and the Compose service `localstack`, on port 4566. Other endpoints use the normal
AWS credential chain/profile; real credentials are never embedded in the script.

For an **authorized** AWS seed, use an authenticated profile and a globally unique
evidence bucket chosen for that account, per contracts §4.2:

```bash
AWS_ENDPOINT_URL= AWS_PROFILE=team-demo S3_BUCKET_EVIDENCE=YOUR_UNIQUE_BUCKET \
  python scripts/seed_local.py
```

In Windows PowerShell 5, setting an environment variable to `""` can remove it.
Set `AWS_ENDPOINT_URL=` in `.env` instead, and ensure no exported value overrides
it. Do not overwrite an existing `.env` merely to apply changes from `.env.example`.
AWS seed support is tested with mocked SDK construction/region cases; acceptance
runs target LocalStack only. No real AWS resources were provisioned for WP-05.

## What seed changes

- Creates missing tables, PAY_PER_REQUEST, deletion protection off, exact keys and
  GSIs with ALL projection. PITR defaults off. Waits for tables and checks indexes.
- Reuses existing tables only if schema, billing and backup policy match. It
  refuses incompatible resources instead of silently replacing them.
- Creates the configured bucket, with the region-specific S3 creation parameters.
  Applies Block Public Access and SSE-S3; new buckets expire objects after 30 days.
  Existing buckets must already have a 30-day expiry rule covering all objects;
  incompatible/missing rules cause an error instead of being overwritten.
  Enabled versioning is refused to prevent new duplicate versions.
- Reads JSON money as Decimal. Upserts transactions through `batch_writer` using
  `sk = posted_at + "#" + transaction_id`. The two case/decision tables start empty.
- Uploads 37 PDFs under invoices/, 15 RFC-822 emails under emails/, and 6 PDFs under
  terms/ in the current dataset. Content types are application/pdf and message/rfc822.
  Ground truth is never loaded or uploaded.
- Prints JSON with tables created/reused, bucket creation, item and object counts.

An ordinary seed does **not** delete unrelated/stale items or objects. Identical
input is idempotent; after changing transaction identities, use the local reset
to remove stale table records. Existing S3 keys are overwritten, not versioned.

## Reset: destructive, local only

`make demo-reset` validates the local targets and source dataset before deletion,
then deletes **only** chargeguard-transactions, chargeguard-cases and
chargeguard-decisions, recreates and seeds them, and POSTs to **both**:

```text
http://localhost:8001/demo/reset  (bank)
http://localhost:8002/demo/reset  (merchant)
```

It prints each mock's result. A failed bank request does not skip merchant, or
vice versa; any failure gives a nonzero exit. Each request has a 3-second timeout.
There is no transaction spanning storage and HTTP: partial failure is reported,
and the reset can be rerun once dependencies recover.

Deleted cases/decisions and mock runtime history cannot be recovered by this
script. Synthetic transactions are reconstructed from disk. It does not delete
the S3 bucket, unrelated objects, or local files. AWS/nonlocal resets are refused
before any I/O; use a separately reviewed teardown process for AWS.

The script prints elapsed seconds and fails the acceptance check if completion
takes 30 seconds or more. The under-30s target is for a healthy, running local
stack, not a guarantee during network failure or an unresponsive emulator.

## Tests and independent checks

```bash
python -m pytest scripts                  # unit tests; no network mutations
python -m pytest scripts --localstack     # explicit opt-in: seed twice and inspect
python -m ruff check scripts
python -m ruff format --check scripts
```

Integration tests verify a paginated consistent scan against the entire source
JSON, S3 listings, active GSIs and repeated-seed stability. They refuse AWS real.
Unit tests cover schema mismatches, region-specific bucket requests, endpoint
omission, missing profiles, reset targets and failure of either mock.

For AWS CLI checks against LocalStack, use dummy credentials in the current shell
only (not in repository files), then:

```bash
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1
unset AWS_SESSION_TOKEN
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name chargeguard-transactions --select COUNT --query Count --output text
aws --endpoint-url=http://localhost:4566 s3 ls s3://chargeguard-evidence/invoices/
```

SDK references: [batch_writer](https://docs.aws.amazon.com/boto3/latest/reference/services/dynamodb/table/batch_writer.html)
and [region-specific bucket creation](https://docs.aws.amazon.com/boto3/latest/guide/s3-example-creating-buckets.html).

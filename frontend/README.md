# Frontend

React + TypeScript + Vite + Tailwind + shadcn/ui.

## Owner
Alan Herrera

## Pages
- `/` - Dashboard
- `/subscriptions` - List of active subscriptions
- `/cases/:id` - Case timeline
- Decision card (modal, triggered on `/cases/:id` when state = `awaiting_human`)

## Setup
```bash
cd frontend
npm install
npm run dev
```

## Environment

Copy `frontend/.env.example` to `frontend/.env.local` for local frontend settings.

```bash
VITE_CHARGEGUARD_DATA_SOURCE=api
VITE_BACKEND_API_URL=http://localhost:8000
VITE_MOCK_BANK_API_URL=http://localhost:8001
VITE_MOCK_MERCHANT_API_URL=http://localhost:8002
VITE_DEMO_USER_ID=usr_demo
VITE_DEFAULT_CASE_ID=case_spotify_001
```

Use `VITE_CHARGEGUARD_DATA_SOURCE=mock` only when you need the static demo fallback without the backend.

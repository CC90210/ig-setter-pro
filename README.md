# PULSE by OASIS

PULSE is the Instagram DM command center for the Python Playwright intake daemon.

The old workflow-orchestration path has been removed. Current production flow:

1. `python/instagram_engine.py` runs as a persistent Playwright daemon.
2. The daemon reads Instagram DMs from a real logged-in browser session.
3. Inbound DMs are posted to `POST /api/webhook`.
4. PULSE stores threads/messages in Turso and generates doctrine drafts when useful.
5. Dashboard manual replies and approved drafts are queued in `python_outbound_queue`.
6. The Python daemon claims that queue from `GET /api/python/outbox`, sends through Instagram, then records the confirmed outbound through `POST /api/webhook`.

## Python Daemon

The runnable automation also lives in `CMO-Agent/scripts/instagram_engine.py`.
This repository carries a mirrored copy at `python/instagram_engine.py` so the product repo reflects the real runtime architecture.

Run from the CMO-Agent workspace with the local `.env.agents` secrets:

```powershell
python scripts/instagram_engine.py monitor-dms
```

Required local env keys:

```env
PULSE_WEBHOOK_URL=https://ig-setter-pro.vercel.app/api/webhook
PULSE_WEBHOOK_SECRET=...
PULSE_ACCOUNT_ID=...
PULSE_IG_PAGE_ID=...
INSTAGRAM_USERNAME=...
INSTAGRAM_PASSWORD=...
```

## Dashboard

```powershell
npm install
npm run dev
```

The dashboard uses Turso for persistent threads, messages, subscribers, daily stats, and the Python outbound queue.

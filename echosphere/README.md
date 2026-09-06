# EchoSphere

An AI-powered mock interview platform built with **Next.js** (frontend) and **FastAPI** (backend).

---

## Prerequisites

- **Node.js** v18+ and **npm**
- **Python** 3.10+
- A running **PostgreSQL** database (Supabase or local)

---

## 1. Backend — FastAPI Server

### First-time setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Configure environment

Ensure `backend/.env` has all required keys:

```env
DATABASE_URL=postgresql+asyncpg://...
GEMINI_API_KEY=...
ANAM_API_KEY=...          # No surrounding quotes
ANAM_AVATAR_ID=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
```

> **Important:** Do NOT wrap values in quotes inside `.env` (e.g. use `ANAM_API_KEY=abc`, not `ANAM_API_KEY="abc"`).

### Start the backend

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend runs at → **http://127.0.0.1:8000**  
Interactive API docs → **http://127.0.0.1:8000/docs**

### Restart the backend

1. Press `Ctrl + C` in the terminal running uvicorn to stop it.
2. Re-run the start command above.

> If you changed `.env`, always restart — env variables are only loaded at startup.

---

## 2. Frontend — Next.js Server

### First-time setup

```bash
cd echosphere
npm install
```

### Configure environment

Ensure `echosphere/.env.local` exists with:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
```

### Start the frontend

```bash
cd echosphere
npm run dev
```

Frontend runs at → **http://localhost:3000**

### Restart the frontend

1. Press `Ctrl + C` in the terminal to stop it.
2. Re-run `npm run dev`.

> Next.js supports **Hot Module Replacement (HMR)** — most code changes auto-refresh without a full restart. A full restart is only needed when changing `.env.local` or `next.config.*`.

---

## 3. Running Both Together (Recommended)

Open **two separate terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd echosphere
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## 4. Common Issues

| Symptom | Fix |
|---|---|
| `502 Invalid API key` from Anam | Remove quotes around `ANAM_API_KEY` in `backend/.env`, then restart backend |
| `404` on API calls | Make sure the FastAPI backend is running on port 8000 |
| Frontend shows stale data | Restart Next.js if you changed `.env.local` |
| `ModuleNotFoundError` in Python | Run `pip install -r requirements.txt` inside the venv |
| Port 8000 already in use | Run `netstat -ano \| findstr :8000` and kill the process, or change port in uvicorn command |

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Anam AI Docs](https://docs.anam.ai)

# BotCore AI — Phase 1

AI-powered chatbot for Website + Telegram. FastAPI backend · Next.js dashboard · Open AI connection.

---

## Project Structure

```
bot_2/
├── backend/          ← FastAPI Python app → deploy to Railway
└── frontend/         ← Next.js dashboard → deploy to Vercel
```

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Copy and edit env file
copy .env.example .env

# Run PostgreSQL locally (or use Railway URL in .env)
# Then:
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local
# Edit .env.local → set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000

---

## Deploy to Railway (Backend)

1. Push `backend/` folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub repo
3. Select the repo → set root directory to `backend`
4. Add **PostgreSQL** plugin → Railway auto-injects `DATABASE_URL`
5. Add **Redis** plugin → Railway auto-injects `REDIS_URL`
6. Add environment variables:
   - `SECRET_KEY` = random 32-char hex string
   - `ALLOWED_ORIGINS` = your Vercel frontend URL
7. Deploy → copy the Railway URL

---

## Deploy to Vercel (Frontend)

1. Push `frontend/` folder to GitHub (same or separate repo)
2. Go to vercel.com → New Project → import repo
3. Set root directory to `frontend`
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL
5. Deploy

---

## Configure the Bot (Admin Dashboard)

1. Open your Vercel frontend URL
2. Go to **Settings**
3. Paste your AI API key (Groq free at console.groq.com)
4. Set provider endpoint + model name
5. Fill in bot name, tone, business info
6. For Telegram: paste bot token, set webhook URL to `https://your-railway-app.railway.app/api/telegram/webhook`
7. Click **Set Webhook** → click **Save All**

---

## Embed Website Widget

Add this to any webpage:

```html
<script
  src="https://your-railway-app.railway.app/widget/chat.js"
  defer
></script>
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/chat/message | Website chat |
| POST | /api/telegram/webhook | Telegram webhook |
| POST | /api/telegram/setup-webhook | Set Telegram webhook |
| GET | /api/settings | Read bot settings |
| PATCH | /api/settings | Update bot settings |

---

## Phase Roadmap

| Phase | What's Added |
|-------|-------------|
| **1** ✅ | Backend, AI, Telegram, widget, open API, bot identity |
| 2 | Behavior detection, persona scoring, lead capture |
| 3 | Full CRM dashboard + conversations viewer |
| 4 | Voice, image, document processing |
| 5 | Automation engine + follow-up flows |
| 6 | WhatsApp, Facebook, Instagram, orders, broadcasts |
| 7 | PDF knowledge base, RAG, OAuth, comments, analytics |

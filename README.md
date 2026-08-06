# StickyBoard Backend

## Overview
Backend service for StickyBoard, a real-time collaborative sticky note board. Handles data persistence, real-time sync, AI-assisted note retrieval, and automated board snapshots, exposed as an API consumed by the frontend.

## Quick Links
* **Web Application:** [https://stickyboard-frontend.vercel.app](https://stickyboard-frontend.vercel.app)
* **Front-end Repo:** [https://github.com/ChongWengKit/stickyboard-frontend](https://github.com/ChongWengKit/stickyboard-frontend)

## Tech Stack
* **Framework:** Node.js, Express, TypeScript
* **Database & ORM:** PostgreSQL, Prisma ORM
* **Caching & Rate Limiting:** Upstash Redis
* **Real-time Sync:** Pusher
* **AI / Search:** Google Gemini embeddings, Groq-hosted OpenAI-compatible models
* **Snapshots:** Puppeteer, Sharp
* **Media:** Cloudinary

## Key Features
* **Real-Time Sync:** Integrated Pusher for WebSocket sync, since serverless hosting doesn't support persistent connections.
* **AI-Assisted Note Retrieval:** Combined semantic embeddings with cosine similarity and keyword search for smarter note retrieval.
* **AI Assistant:** Integrated Groq-hosted OpenAI-compatible models to provide a cost-effective AI assistant.
* **Automated Snapshots:** Automated board snapshots with Puppeteer and Sharp, built to stay performant with large volumes of notes.
* **Caching & Rate Limiting:** Used Upstash Redis for response caching and API rate limiting.

## ⚙️ Getting Started
```bash
git clone https://github.com/ChongWengKit/stickyboard-backend.git
cd stickyboard-backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## 🔑 Environment Variables

Create a `.env` file in the root and set the following:

* `NODE_ENV` — environment mode (e.g. `local`, `production`)
* `DATABASE_URL` — PostgreSQL connection string
* `MAX_NOTES_PER_IP` — limit on how many notes a single IP can create, for abuse prevention
* `FRONTEND_URL` — frontend origin URL, used for CORS
* `CRON_SCHEDULE` — cron expression controlling when scheduled snapshot/reconciliation jobs run
* `CLOUDINARY_CLOUD_NAME` — Cloudinary account cloud name
* `CLOUDINARY_API_KEY` — Cloudinary API key
* `CLOUDINARY_API_SECRET` — Cloudinary API secret
* `PUSHER_APP_ID` — Pusher app ID for real-time WebSocket sync
* `PUSHER_KEY` — Pusher key
* `PUSHER_SECRET` — Pusher secret
* `PUSHER_CLUSTER` — Pusher cluster region
* `GOOGLE_API_KEY` — Google API key for generating Gemini embeddings
* `GROQ_API_KEY` — Groq API key for the AI assistant
* `SIMILARITY_THRESHOLD` — minimum cosine similarity score for a note to be considered a match in AI-assisted search
* `PORT` — port the server listens on
* `UPSTASH_REDIS_REST_URL` — Upstash Redis REST endpoint
* `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST auth token

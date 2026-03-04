# TestForge

Real-time online exam platform project scaffold.

## Structure

- `server/` - backend service (Node/Express)
- `client/` - front-end (React) (empty for now)

## Getting started

Backend:

```bash
cd server
npm install
npm run dev
```

Frontend (React/Vite):

```bash
cd Client
npm install
npm run dev
```

The client is configured to talk to the backend at `http://localhost:4000/api` (see `.env`, using `VITE_API_URL`).

This repository is designed to demonstrate a microservice-like structure with features such as real-time monitoring, anti-cheat, Redis caching, and queue-based result processing.

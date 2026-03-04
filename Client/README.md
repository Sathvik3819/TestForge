# TestForge Frontend

This is the React/Vite frontend for the TestForge online exam platform. It interfaces with the backend service at `http://localhost:4000/api` (configurable via `.env` using `VITE_API_URL`). Features include:

- Signup/login with JWT authentication
- Student dashboard to list and take exams
- Real-time timer and basic anti-cheat (tab‑switch detection)
- Admin panel for creating exams and adding questions
- Routing with React Router v6 and protected routes



## Getting started

```bash
cd Client
npm install
npm run dev
```

Then open http://localhost:5173 (or the port Vite outputs) in your browser.

The frontend works with the backend running separately. See the top‑level README for backend instructions.

> This application is intended as a resume‑worthy demo of a real‑time microservice system with caching, queues, and anti‑cheat logic. It is not production hardened.

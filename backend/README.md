# BuildMyResume Backend

Production-oriented Express backend for BuildMyResume with:
- Firebase ID token based authentication
- MongoDB persistence for user profiles
- Groq-powered AI resume tailoring

## 1. Setup

```bash
npm install
cp .env.example .env
```

Fill Firebase Admin credentials and `GROQ_API_KEY` in `.env`.

## 2. Run

```bash
npm run dev
```

Server runs at `http://localhost:8000` by default.

## 3. API Summary

- `GET /api/v1/healthcheck`
- `POST /api/v1/auth/firebase/sign-in`
- `GET /api/v1/auth/me` (Bearer Firebase ID token)
- `POST /api/v1/ai/tailor` (Bearer Firebase ID token)

## 4. Auth Flow

1. Frontend signs in with Firebase client SDK.
2. Frontend gets Firebase ID token via `currentUser.getIdToken()`.
3. Frontend sends token in `Authorization: Bearer <token>`.
4. Backend verifies token via Firebase Admin and authorizes request.

## 5. AI Tailor Request Body

```json
{
  "jobDescription": "Role details...",
  "resumeText": "Current resume text...",
  "tone": "professional",
  "maxBullets": 6
}
```

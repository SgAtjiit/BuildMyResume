process.env.NODE_ENV = "test";
process.env.PORT = "8001";
process.env.API_PREFIX = "/api/v1";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.MONGODB_URI = "mongodb://localhost:27017";

process.env.FIREBASE_PROJECT_ID = "demo-project";
process.env.FIREBASE_CLIENT_EMAIL = "";
process.env.FIREBASE_PRIVATE_KEY = "";
process.env.FIREBASE_API_KEY = "firebase-api-key";

process.env.GROQ_API_KEY = "groq-api-key";
process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
process.env.LATEX_BIN_DIR = "";

process.env.VERCEL_OAUTH_CLIENT_ID = "vercel-client-id";
process.env.VERCEL_OAUTH_CLIENT_SECRET = "vercel-client-secret";
process.env.VERCEL_OAUTH_REDIRECT_URI = "http://localhost:8000/api/v1/auth/vercel/callback";
process.env.VERCEL_OAUTH_SCOPE = "project:write deployment:write";
process.env.VERCEL_OAUTH_STATE_SECRET = "state-secret-for-tests";
process.env.VERCEL_PLATFORM_TOKEN = "platform-token-test";
process.env.VERCEL_API_BASE_URL = "https://api.vercel.com";
process.env.TOKEN_ENCRYPTION_KEY = "01234567890123456789012345678901";

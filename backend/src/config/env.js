import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().default(""),
  FIREBASE_PRIVATE_KEY: z.string().default(""),
  FIREBASE_API_KEY: z.string().min(1, "FIREBASE_API_KEY is required"),

  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CLOUDINARY_RESUME_FOLDER: z.string().default("buildmyresume/resumes"),
  // LATEX_BIN_DIR: z.string().optional().default(""),

  // VERCEL_OAUTH_CLIENT_ID: z.string().optional().default(""),
  // VERCEL_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  // VERCEL_OAUTH_REDIRECT_URI: z.string().optional().default(""),
  // VERCEL_OAUTH_SCOPE: z.string().default("project:write deployment:write"),
  // VERCEL_OAUTH_STATE_SECRET: z.string().optional().default(""),
  // VERCEL_PLATFORM_TOKEN: z.string().optional().default(""),
  // VERCEL_API_BASE_URL: z.string().default("https://api.vercel.com"),
  // TOKEN_ENCRYPTION_KEY: z.string().min(32, "TOKEN_ENCRYPTION_KEY (>=32 chars) is required"),

  CF_ACCOUNT_ID: z.string().optional().default(""),
  CF_API_TOKEN: z.string().optional().default("")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

export const env = parsed.data;

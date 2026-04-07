import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/error.middleware.js";

import healthcheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js";
import aiRouter from "./routes/ai.routes.js";
import resumeRouter from "./routes/resume.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import projectRouter from "./routes/project.routes.js";
import oneClickPortfolioRouter from "./routes/portfolio.js";

const app = express();
const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");
const allowedOrigins = Array.from(
  new Set(
    String(env.CORS_ORIGIN || "")
      .split(",")
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean)
  )
);

const defaultCspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();

app.use(
  helmet({
    // Allow the frontend app origin to embed PDF files served by this backend.
    contentSecurityPolicy: {
      directives: {
        ...defaultCspDirectives,
        "frame-ancestors": ["'self'", ...allowedOrigins]
      }
    },
    xFrameOptions: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(compression());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(env.API_PREFIX, apiLimiter);
app.use(`${env.API_PREFIX}/healthcheck`, healthcheckRouter);
app.use(`${env.API_PREFIX}/auth`, authRouter);
app.use(`${env.API_PREFIX}/ai`, aiRouter);
app.use(`${env.API_PREFIX}/resumes`, resumeRouter);
app.use(`${env.API_PREFIX}/dashboard`, dashboardRouter);
app.use(`${env.API_PREFIX}/projects`, projectRouter);
app.use("/portfolio", oneClickPortfolioRouter);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export { app };

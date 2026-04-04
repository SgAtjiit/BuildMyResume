import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDeploymentStatus = vi.fn();

vi.mock("../src/services/vercel.service.js", async () => {
  const actual = await vi.importActual("../src/services/vercel.service.js");
  return {
    ...actual,
    VercelService: {
      ...actual.VercelService,
      getDeploymentStatus
    }
  };
});

describe("Portfolio status mapping integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Vercel states to BUILDING/READY/ERROR", async () => {
    const { getPortfolioDeploymentStatus } = await import("../src/contollers/portfolio.controller.js");

    getDeploymentStatus.mockImplementation(async ({ deploymentId }) => {
      if (deploymentId === "dep_ready") {
        return { id: deploymentId, readyState: "READY", url: "ready.app" };
      }

      if (deploymentId === "dep_error") {
        return { id: deploymentId, readyState: "CANCELED", url: null, errorMessage: "Build failed" };
      }

      return { id: deploymentId, readyState: "QUEUED", url: null };
    });

    const app = express();
    app.use((req, _res, next) => {
      req.vercelAuth = { token: "x", teamId: "", source: "platform" };
      next();
    });
    app.get("/api/v1/portfolio/status/:id", getPortfolioDeploymentStatus);

    const buildingResponse = await request(app).get("/api/v1/portfolio/status/dep_building");
    expect(buildingResponse.status).toBe(200);
    expect(buildingResponse.body.data.status).toBe("BUILDING");

    const readyResponse = await request(app).get("/api/v1/portfolio/status/dep_ready");
    expect(readyResponse.status).toBe(200);
    expect(readyResponse.body.data.status).toBe("READY");

    const errorResponse = await request(app).get("/api/v1/portfolio/status/dep_error");
    expect(errorResponse.status).toBe(200);
    expect(errorResponse.body.data.status).toBe("ERROR");
  });
});

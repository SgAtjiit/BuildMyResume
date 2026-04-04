import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeOAuthCode = vi.fn();
const findUserByFirebaseUid = vi.fn();

vi.mock("../src/services/vercel.service.js", async () => {
  const actual = await vi.importActual("../src/services/vercel.service.js");
  return {
    ...actual,
    VercelService: {
      ...actual.VercelService,
      exchangeOAuthCode
    }
  };
});

vi.mock("../src/services/user.service.js", () => ({
  findUserByFirebaseUid
}));

describe("Vercel OAuth callback integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores encrypted token and returns connected response", async () => {
    const { handleVercelOAuthCallback } = await import("../src/contollers/auth.controller.js");
    const { createOAuthState } = await import("../src/utils/vercel-oauth-state.js");

    const user = {
      vercelConnection: {},
      save: vi.fn().mockResolvedValue(undefined)
    };

    exchangeOAuthCode.mockResolvedValue({
      access_token: "user-access-token",
      scope: "project:write deployment:write",
      team_id: "team_123"
    });
    findUserByFirebaseUid.mockResolvedValue(user);

    const app = express();
    app.get("/api/v1/auth/vercel/callback", handleVercelOAuthCallback);

    const state = createOAuthState({
      uid: "firebase_uid_1",
      ts: Date.now()
    });

    const response = await request(app)
      .get("/api/v1/auth/vercel/callback")
      .query({ code: "oauth_code_1", state });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.connected).toBe(true);
    expect(exchangeOAuthCode).toHaveBeenCalledWith({ code: "oauth_code_1" });
    expect(findUserByFirebaseUid).toHaveBeenCalledWith("firebase_uid_1");
    expect(user.vercelConnection.encryptedAccessToken).toBeTruthy();
    expect(user.vercelConnection.encryptedAccessToken).not.toBe("user-access-token");
    expect(user.vercelConnection.teamId).toBe("team_123");
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

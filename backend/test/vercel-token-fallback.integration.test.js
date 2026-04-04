import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { encryptToken } from "../src/utils/vercel-token-crypto.js";
import { VercelService } from "../src/services/vercel.service.js";

const originalFetch = global.fetch;

describe("Vercel auth token selection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("prefers connected user token", async () => {
    const encrypted = encryptToken("user-token-abc");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "usr_1" })
    });

    const auth = await VercelService.resolveAuth({
      vercelConnection: {
        ...encrypted,
        teamId: "team_A"
      }
    });

    expect(auth.source).toBe("user");
    expect(auth.token).toBe("user-token-abc");
    expect(auth.teamId).toBe("team_A");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(String(calledUrl)).toContain("/v2/user?teamId=team_A");
  });

  it("falls back to platform token when user is not connected", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "usr_platform" })
    });

    const auth = await VercelService.resolveAuth({
      vercelConnection: {
        encryptedAccessToken: "",
        tokenIv: "",
        tokenAuthTag: "",
        teamId: ""
      }
    });

    expect(auth.source).toBe("platform");
    expect(auth.token).toBe("platform-token-test");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(String(calledUrl)).toContain("/v2/user");
  });
});

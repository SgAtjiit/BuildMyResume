import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { decryptToken } from "../utils/vercel-token-crypto.js";

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const buildAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
});

const withTeamQuery = (teamId) => {
  if (!teamId) {
    return "";
  }

  const params = new URLSearchParams({ teamId });
  return `?${params.toString()}`;
};

const vercelFetch = async ({ path, method = "GET", token, body, teamId }) => {
  const response = await fetch(`${env.VERCEL_API_BASE_URL}${path}${withTeamQuery(teamId)}`, {
    method,
    headers: buildAuthHeaders(token),
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const isAuthError = response.status === 401 || response.status === 403;

    if (isAuthError) {
      throw new ApiError(401, "Vercel token is invalid or expired. Please reconnect Vercel.", payload.error || []);
    }

    throw new ApiError(response.status, payload.error?.message || "Vercel API request failed", payload.error || payload);
  }

  return payload;
};

const getUserToken = (user) => {
  const connection = user.vercelConnection || {};

  if (!connection.encryptedAccessToken) {
    return null;
  }

  return {
    token: decryptToken(connection),
    teamId: connection.teamId || "",
    source: "user"
  };
};

const getPlatformToken = () => {
  if (!env.VERCEL_PLATFORM_TOKEN) {
    throw new ApiError(500, "Platform Vercel token is not configured");
  }

  return {
    token: env.VERCEL_PLATFORM_TOKEN,
    teamId: "",
    source: "platform"
  };
};

export class VercelService {
  static async resolveAuth(user) {
    const userAuth = getUserToken(user);

    if (userAuth) {
      await vercelFetch({ path: "/v2/user", token: userAuth.token, teamId: userAuth.teamId });
      return userAuth;
    }

    const platformAuth = getPlatformToken();
    await vercelFetch({ path: "/v2/user", token: platformAuth.token });
    return platformAuth;
  }

  static async exchangeOAuthCode({ code }) {
    if (!env.VERCEL_OAUTH_CLIENT_ID || !env.VERCEL_OAUTH_CLIENT_SECRET || !env.VERCEL_OAUTH_REDIRECT_URI) {
      throw new ApiError(500, "Vercel OAuth is not configured");
    }

    const response = await fetch(`${env.VERCEL_API_BASE_URL}/v2/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        client_id: env.VERCEL_OAUTH_CLIENT_ID,
        client_secret: env.VERCEL_OAUTH_CLIENT_SECRET,
        redirect_uri: env.VERCEL_OAUTH_REDIRECT_URI
      })
    });

    const payload = await parseJson(response);

    if (!response.ok) {
      throw new ApiError(response.status, payload.error?.message || "Failed to exchange Vercel OAuth code", payload.error || payload);
    }

    return payload;
  }

  static async createDeployment({ auth, name, files, framework }) {
    const payload = {
      name,
      target: "production",
      files,
      projectSettings: {
        framework
      }
    };

    return vercelFetch({
      path: "/v13/deployments",
      method: "POST",
      token: auth.token,
      teamId: auth.teamId,
      body: payload
    });
  }

  static async getDeploymentStatus({ auth, deploymentId }) {
    return vercelFetch({
      path: `/v13/deployments/${deploymentId}`,
      token: auth.token,
      teamId: auth.teamId
    });
  }

  static async addCustomDomain({ auth, projectId, domain }) {
    return vercelFetch({
      path: `/v9/projects/${projectId}/domains`,
      method: "POST",
      token: auth.token,
      teamId: auth.teamId,
      body: {
        name: domain
      }
    });
  }
}

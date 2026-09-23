import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { z } from "zod";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  InvalidGrantError,
  InvalidTokenError,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
  requireBearerAuth,
  type AuthInfo,
  type OAuthServerProvider,
} from "@modelcontextprotocol/server-legacy/auth";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/client";

export interface OAuthFixtureOptions {
  /**
   * How the authorization callback carries RFC 9207 `iss`:
   * - "sent" (default): appended by the SDK's authorize handler, and advertised;
   * - "omitted": missing from the callback while metadata still advertises it;
   * - "unsupported": missing, and metadata says the server does not send it.
   */
  iss?: "sent" | "omitted" | "unsupported";
  /** Access-token lifetime in seconds (default 3600). */
  accessTokenTtl?: number;
}

export interface OAuthFixture {
  base: string;
  mcpUrl: string;
  sseUrl: string;
  /** Every request the fixture received, in order. */
  requests: Array<{ method: string; path: string; authorization?: string }>;
  stats: { registrations: number; exchanges: number; refreshes: number };
  /** Issue a valid access token without running OAuth (for token providers). */
  mintAccessToken(): string;
  /** Make every issued access token fail verification; refresh tokens stay valid. */
  expireAccessTokens(): void;
  /** Invalidate every access and refresh token. */
  revokeAll(): void;
  close(): Promise<void>;
}

/**
 * An in-process OAuth 2.1 authorization server (the SDK's `mcpAuthRouter`
 * with an in-memory provider: PKCE, dynamic client registration, refresh)
 * in front of a bearer-guarded MCP server. Binds to 127.0.0.1, which the SDK
 * treats as loopback for non-TLS token endpoints.
 */
export async function startOAuthFixture(
  options: OAuthFixtureOptions = {}
): Promise<OAuthFixture> {
  const iss = options.iss ?? "sent";
  const ttl = options.accessTokenTtl ?? 3600;
  const clients = new Map<string, OAuthClientInformationFull>();
  const codes = new Map<string, { clientId: string; challenge: string }>();
  const access = new Map<string, { clientId: string; expiresAt: number }>();
  const refresh = new Map<string, string>();
  const requests: OAuthFixture["requests"] = [];
  const stats = { registrations: 0, exchanges: 0, refreshes: 0 };

  const issue = (clientId: string): OAuthTokens => {
    const accessToken = `at-${randomUUID()}`;
    const refreshToken = `rt-${randomUUID()}`;
    access.set(accessToken, { clientId, expiresAt: Date.now() + ttl * 1000 });
    refresh.set(refreshToken, clientId);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ttl,
      refresh_token: refreshToken,
    };
  };

  const provider: OAuthServerProvider = {
    authorizationResponseIssParameterSupported: iss !== "unsupported",
    clientsStore: {
      getClient: (clientId) => clients.get(clientId),
      registerClient: (metadata) => {
        stats.registrations += 1;
        const client = {
          ...metadata,
          client_id: randomUUID(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        clients.set(client.client_id, client);
        return client;
      },
    },
    async authorize(client, params, res) {
      const code = randomUUID();
      codes.set(code, {
        clientId: client.client_id,
        challenge: params.codeChallenge,
      });
      const target = new URL(params.redirectUri);
      target.searchParams.set("code", code);
      if (params.state !== undefined)
        target.searchParams.set("state", params.state);
      // `res.redirect` lets the SDK handler append `iss`; writing the header
      // directly bypasses it, which is how "omitted"/"unsupported" drop it.
      if (iss === "sent") res.redirect(target.href);
      else res.writeHead(302, { Location: target.href }).end();
    },
    async challengeForAuthorizationCode(_client, code) {
      const entry = codes.get(code);
      if (!entry) throw new InvalidGrantError("unknown authorization code");
      return entry.challenge;
    },
    async exchangeAuthorizationCode(client, code) {
      const entry = codes.get(code);
      if (!entry || entry.clientId !== client.client_id)
        throw new InvalidGrantError("unknown authorization code");
      codes.delete(code);
      stats.exchanges += 1;
      return issue(client.client_id);
    },
    async exchangeRefreshToken(client, refreshToken) {
      if (refresh.get(refreshToken) !== client.client_id)
        throw new InvalidGrantError("unknown refresh token");
      refresh.delete(refreshToken);
      stats.refreshes += 1;
      return issue(client.client_id);
    },
    async verifyAccessToken(token): Promise<AuthInfo> {
      const entry = access.get(token);
      if (!entry || entry.expiresAt <= Date.now())
        throw new InvalidTokenError("invalid or expired access token");
      return {
        token,
        clientId: entry.clientId,
        scopes: [],
        expiresAt: Math.floor(entry.expiresAt / 1000),
      };
    },
  };

  const app = express();
  app.use((req, _res, next) => {
    requests.push({
      method: req.method,
      path: req.path,
      authorization: req.headers.authorization,
    });
    next();
  });

  const http = app.listen(0, "127.0.0.1");
  await once(http, "listening");
  const { port } = z.object({ port: z.number() }).parse(http.address());
  const base = `http://127.0.0.1:${port}`;
  const mcpUrl = `${base}/mcp`;

  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(base),
      resourceServerUrl: new URL(mcpUrl),
      // Tests replay many flows quickly; rate limits only add flakiness here.
      authorizationOptions: { rateLimit: false },
      clientRegistrationOptions: { rateLimit: false },
      tokenOptions: { rateLimit: false },
    })
  );

  const bearer = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(mcpUrl)),
  });

  const handleMcp = toNodeHandler(
    createMcpHandler(
      () => {
        const server = new McpServer({
          name: "oauth-fixture",
          version: "1.0.0",
        });
        server.registerTool(
          "whoami",
          {
            description: "Reports that the caller is authorized",
            inputSchema: z.object({}),
          },
          async () => ({ content: [{ type: "text", text: "authorized" }] })
        );
        return server;
      },
      { legacy: "stateless" }
    )
  );

  app.all("/mcp", bearer, (req, res) => handleMcp(req, res));
  // SSE tests only exercise the 401 path and the token exchange.
  app.get("/sse", bearer, (_req, res) => {
    res.status(501).end();
  });

  return {
    base,
    mcpUrl,
    sseUrl: `${base}/sse`,
    requests,
    stats,
    mintAccessToken: () => issue("minted").access_token,
    expireAccessTokens: () => {
      for (const entry of access.values()) entry.expiresAt = 0;
    },
    revokeAll: () => {
      access.clear();
      refresh.clear();
    },
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}

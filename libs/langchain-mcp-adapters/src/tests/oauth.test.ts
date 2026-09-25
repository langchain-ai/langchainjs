import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  MCPAdapter,
  MCPClientError,
  UnauthorizedError,
  type MCPAdapterConfig,
} from "../index.js";
import { getHttpErrorCode, isAuthenticationError } from "../utils/errors.js";
import {
  startOAuthFixture,
  type OAuthFixture,
  type OAuthFixtureOptions,
} from "./fixtures/oauth-server.js";
import { createTestOAuthProvider } from "./fixtures/oauth-client.js";

const cleanup: Array<() => Promise<unknown>> = [];

afterEach(async () => {
  for (const step of cleanup.splice(0).reverse()) await step();
});

async function fixture(options?: OAuthFixtureOptions): Promise<OAuthFixture> {
  const started = await startOAuthFixture(options);
  cleanup.push(() => started.close());
  return started;
}

function adapter(config: MCPAdapterConfig) {
  const created = new MCPAdapter(config);
  cleanup.push(() => created.close());
  return created;
}

const toolNames = (tools: ReadonlyArray<{ name: string }>) =>
  tools.map((tool) => tool.name);

const hasWhoami = (tools: ReadonlyArray<{ name: string }>) =>
  toolNames(tools).some((name) => name.endsWith("whoami"));

/** Await a rejection that must be an MCPClientError, and return it. */
async function failure(promise: Promise<unknown>): Promise<MCPClientError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason
  );
  if (!MCPClientError.isInstance(error))
    throw new Error(`expected MCPClientError, got ${String(error)}`);
  return error;
}

describe("OAuth fixture", () => {
  it("advertises RFC 9207 support and challenges unauthenticated MCP requests", async () => {
    const server = await fixture();
    const metadata = z
      .object({ authorization_response_iss_parameter_supported: z.boolean() })
      .parse(
        await (
          await fetch(`${server.base}/.well-known/oauth-authorization-server`)
        ).json()
      );
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true);

    const challenge = await fetch(server.mcpUrl, { method: "POST" });
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toContain(
      "resource_metadata="
    );
  });

  it("serves tools to a valid bearer token", async () => {
    const server = await fixture();
    const token = server.mintAccessToken();
    const tools = await adapter({
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    }).listTools();
    expect(hasWhoami(tools)).toBe(true);
  });
});

describe("token providers", () => {
  it("connects with { token }", async () => {
    const server = await fixture();
    const token = server.mintAccessToken();
    const tools = await adapter({
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          authProvider: { token: async () => token },
        },
      },
    }).listTools();

    expect(hasWhoami(tools)).toBe(true);
    const sent = server.requests
      .filter((request) => request.path === "/mcp")
      .map((request) => request.authorization);
    expect(new Set(sent)).toEqual(new Set([`Bearer ${token}`]));
  });

  it("refreshes through onUnauthorized and retries once", async () => {
    const server = await fixture();
    let current = "stale";
    const onUnauthorized = vi.fn(async () => {
      current = server.mintAccessToken();
    });
    const tools = await adapter({
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          authProvider: { token: async () => current, onUnauthorized },
        },
      },
    }).listTools();

    expect(hasWhoami(tools)).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an empty object", {}],
    ["a non-callable token", { token: "abc" }],
    [
      "a non-callable onUnauthorized",
      { token: async () => "t", onUnauthorized: 1 },
    ],
    ["null", null],
    ["a string", "token"],
  ])("rejects %s at construction", (_label, authProvider) => {
    expect(
      () =>
        new MCPAdapter({
          servers: {
            svc: {
              transport: "http",
              url: "http://127.0.0.1:1/mcp",
              authProvider: authProvider as never,
            },
          },
        })
    ).toThrow();
  });
});

describe("auth failure labeling", () => {
  it("labels a provider flow on HTTP and keeps UnauthorizedError as the cause", async () => {
    const server = await fixture();
    const error = await failure(
      adapter({
        servers: {
          svc: {
            transport: "http",
            url: server.mcpUrl,
            authProvider: createTestOAuthProvider(),
          },
        },
      }).listTools()
    );
    expect(error.message).toMatch(
      /^Authentication failed for HTTP server "svc"/
    );
    expect(error.cause).toBeInstanceOf(UnauthorizedError);
  });

  it("labels a provider flow on SSE", async () => {
    const server = await fixture();
    const error = await failure(
      adapter({
        servers: {
          svc: {
            transport: "sse",
            url: server.sseUrl,
            authProvider: createTestOAuthProvider(),
          },
        },
      }).listTools()
    );
    expect(error.message).toMatch(
      /^Authentication failed for SSE server "svc"/
    );
    expect(error.cause).toBeInstanceOf(UnauthorizedError);
  });

  it("labels a 401 without a provider, with the HTTP status on the cause", async () => {
    const server = await fixture();
    const error = await failure(
      adapter({
        servers: { svc: { transport: "http", url: server.mcpUrl } },
      }).listTools()
    );
    expect(error.message).toMatch(
      /^Authentication failed for HTTP server "svc"/
    );
    expect(getHttpErrorCode(error.cause)).toBe(401);
  });

  it("never falls back to SSE from a legacy-mode provider flow", async () => {
    const server = await fixture();
    const error = await failure(
      adapter({
        servers: {
          svc: {
            transport: "http",
            mode: "legacy",
            url: server.mcpUrl,
            authProvider: createTestOAuthProvider(),
          },
        },
      }).listTools()
    );
    expect(error.cause).toBeInstanceOf(UnauthorizedError);
    expect(server.requests.some((request) => request.path === "/sse")).toBe(
      false
    );
  });

  it("keeps a throwing token() as the cause and does not call it an auth failure", async () => {
    const server = await fixture();
    const error = await failure(
      adapter({
        servers: {
          svc: {
            transport: "http",
            url: server.mcpUrl,
            authProvider: {
              token: async () => {
                throw new Error("vault unavailable");
              },
            },
          },
        },
      }).listTools()
    );
    expect(error.message).not.toMatch(/^Authentication failed/);
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).message).toBe("vault unavailable");
  });
});

describe("auth failures stay retryable", () => {
  function tokenAdapter(
    server: OAuthFixture,
    token: () => string,
    onConnectionError:
      | "ignore"
      | ((params: { serverName: string; error: unknown }) => void)
  ) {
    return adapter({
      onConnectionError,
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          authProvider: { token: async () => token() },
        },
      },
    });
  }

  it("retries an auth-failed server under onConnectionError: ignore", async () => {
    const server = await fixture();
    let token = "not-yet-valid";
    const mcp = tokenAdapter(server, () => token, "ignore");

    expect(await mcp.listTools()).toEqual([]);
    token = server.mintAccessToken();
    expect(hasWhoami(await mcp.listTools())).toBe(true);
  });

  it("reports each auth failure to the handler and retries", async () => {
    const server = await fixture();
    let token = "not-yet-valid";
    const onConnectionError = vi.fn();
    const mcp = tokenAdapter(server, () => token, onConnectionError);

    expect(await mcp.listTools()).toEqual([]);
    expect(onConnectionError).toHaveBeenCalledTimes(1);
    expect(
      isAuthenticationError(onConnectionError.mock.calls[0][0].error)
    ).toBe(true);

    token = server.mintAccessToken();
    expect(hasWhoami(await mcp.listTools())).toBe(true);
    expect(onConnectionError).toHaveBeenCalledTimes(1);
  });

  it("retries a legacy-mode server whose HTTP→SSE fallback also 401s", async () => {
    const server = await fixture();
    const onConnectionError = vi.fn();
    const mcp = adapter({
      onConnectionError,
      servers: {
        svc: {
          transport: "http",
          mode: "legacy",
          automaticSSEFallback: true,
          url: server.mcpUrl,
        },
      },
    });

    expect(await mcp.listTools()).toEqual([]);
    expect(onConnectionError).toHaveBeenCalledTimes(1);
    expect(server.requests.some((request) => request.path === "/sse")).toBe(
      true
    );

    const [{ error }] = onConnectionError.mock.calls[0];
    expect(MCPClientError.isInstance(error)).toBe(true);
    expect(MCPClientError.isInstance((error as MCPClientError).cause)).toBe(
      true
    );
    expect(isAuthenticationError(error)).toBe(true);

    expect(await mcp.listTools()).toEqual([]);
    expect(onConnectionError).toHaveBeenCalledTimes(2);
  });

  it("keeps an unreachable server blocked", async () => {
    const onConnectionError = vi.fn();
    const mcp = adapter({
      onConnectionError,
      servers: { down: { transport: "http", url: "http://127.0.0.1:1/mcp" } },
    });
    await mcp.listTools();
    await mcp.listTools();
    expect(onConnectionError).toHaveBeenCalledTimes(1);
  });

  it("keeps a throwing token provider blocked", async () => {
    const server = await fixture();
    const onConnectionError = vi.fn();
    const mcp = adapter({
      onConnectionError,
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          authProvider: {
            token: async () => {
              throw new Error("vault unavailable");
            },
          },
        },
      },
    });
    await mcp.listTools();
    await mcp.listTools();
    expect(onConnectionError).toHaveBeenCalledTimes(1);
  });
});

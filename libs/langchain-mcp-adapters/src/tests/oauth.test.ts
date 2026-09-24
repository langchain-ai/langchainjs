import { afterEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import {
  IssuerMismatchError,
  OAuthError,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
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
import {
  authorizeInBrowser,
  createTestOAuthProvider,
} from "./fixtures/oauth-client.js";

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
    ).toThrow(ZodError);
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

/** Start a login: the first discovery fails and hands out one authorization URL. */
async function pendingLogin(
  options: {
    iss?: OAuthFixtureOptions["iss"];
    state?: string;
    persistDiscovery?: boolean;
    transport?: "http" | "sse";
  } = {}
) {
  const server = await fixture({ iss: options.iss });
  const provider = createTestOAuthProvider({
    state: options.state,
    persistDiscovery: options.persistDiscovery,
  });
  const transport = options.transport ?? "http";
  const mcp = adapter({
    servers: {
      // A widened `transport` variable does not narrow the discriminated
      // union below, so each branch is written with its literal directly.
      svc:
        transport === "sse"
          ? { transport: "sse", url: server.sseUrl, authProvider: provider }
          : { transport: "http", url: server.mcpUrl, authProvider: provider },
    },
  });
  const error = await failure(mcp.listTools());
  expect(error.cause).toBeInstanceOf(UnauthorizedError);
  expect(provider.redirects).toHaveLength(1);
  const callback = await authorizeInBrowser(provider.redirects[0]);
  return { server, provider, mcp, callback };
}

describe("finishAuth", () => {
  it.each([false, true])(
    "completes a redirect login (persisted discovery: %s)",
    async (persistDiscovery) => {
      const { server, mcp, callback } = await pendingLogin({
        persistDiscovery,
      });
      await mcp.finishAuth("svc", callback);
      expect(hasWhoami(await mcp.listTools())).toBe(true);
      expect(server.stats.exchanges).toBe(1);
    }
  );

  it("completes the exchange for an SSE server", async () => {
    const { server, provider, mcp, callback } = await pendingLogin({
      transport: "sse",
    });
    await mcp.finishAuth("svc", callback);
    expect(provider.stored.tokens?.access_token).toBeDefined();
    expect(server.stats.exchanges).toBe(1);
  });

  it("rejects a tampered iss before redeeming the code, without echoing callback text", async () => {
    const { server, provider, mcp, callback } = await pendingLogin();
    callback.set("iss", "http://attacker.invalid/");
    callback.set("error_description", "attacker-text");
    const error = await failure(mcp.finishAuth("svc", callback));
    expect(error.cause).toBeInstanceOf(IssuerMismatchError);
    expect(error.message).not.toContain("attacker-text");
    expect(error.message).not.toContain("attacker.invalid");
    expect(server.stats.exchanges).toBe(0);
    expect(provider.stored.tokens).toBeUndefined();
  });

  it("rejects a callback without iss when the server advertises it", async () => {
    const { server, mcp, callback } = await pendingLogin({ iss: "omitted" });
    expect(callback.has("iss")).toBe(false);
    const error = await failure(mcp.finishAuth("svc", callback));
    expect(error.cause).toBeInstanceOf(IssuerMismatchError);
    expect(server.stats.exchanges).toBe(0);
  });

  it("accepts a callback without iss when the server does not send it", async () => {
    const { server, mcp, callback } = await pendingLogin({
      iss: "unsupported",
    });
    await mcp.finishAuth("svc", callback);
    expect(server.stats.exchanges).toBe(1);
  });

  it("surfaces an error= callback as OAuthError", async () => {
    const { mcp, callback } = await pendingLogin();
    const denied = new URLSearchParams({
      error: "access_denied",
      error_description: "user declined",
      iss: callback.get("iss") ?? "",
    });
    const error = await failure(mcp.finishAuth("svc", denied));
    expect(error.cause).toBeInstanceOf(OAuthError);
  });

  it("rejects an unknown server, a stdio server, and a token-only provider", async () => {
    const server = await fixture();
    const mcp = adapter({
      servers: {
        local: { transport: "stdio", command: "node", args: ["-e", ""] },
        token: {
          transport: "http",
          url: server.mcpUrl,
          authProvider: { token: async () => "t" },
        },
      },
    });
    const params = new URLSearchParams({ code: "c" });
    expect((await failure(mcp.finishAuth("missing", params))).message).toMatch(
      /^MCP server "missing" is not configured/
    );
    expect((await failure(mcp.finishAuth("local", params))).message).toMatch(
      /^OAuth applies to HTTP and SSE servers, but "local" uses stdio/
    );
    // Anchored: the SDK's own message also names OAuthClientProvider.
    expect((await failure(mcp.finishAuth("token", params))).message).toMatch(
      /^finishAuth requires an OAuthClientProvider/
    );
  });

  it("uses a per-call provider override", async () => {
    const server = await fixture();
    const provider = createTestOAuthProvider();
    const mcp = adapter({
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          authProvider: { token: async () => "not-valid" },
        },
      },
    });
    await failure(mcp.listToolsets({ authProvider: provider }));
    const callback = await authorizeInBrowser(provider.redirects[0]);
    await mcp.finishAuth("svc", callback, { authProvider: provider });
    const toolsets = await mcp.listToolsets({ authProvider: provider });
    expect(hasWhoami(toolsets.svc)).toBe(true);
  });

  it("sends no MCP request and closes the transport it creates", async () => {
    const { server, mcp, callback } = await pendingLogin();
    const before = server.requests.filter(
      (request) => request.path === "/mcp"
    ).length;
    const close = vi.spyOn(StreamableHTTPClientTransport.prototype, "close");
    try {
      await mcp.finishAuth("svc", callback);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
    expect(
      server.requests.filter((request) => request.path === "/mcp")
    ).toHaveLength(before);
  });

  it("requires URLSearchParams", async () => {
    const { mcp, callback } = await pendingLogin();
    await expect(
      mcp.finishAuth("svc", `http://127.0.0.1:9/callback?${callback}` as never)
    ).rejects.toThrow(/URLSearchParams/);
  });

  describe("expectedState", () => {
    it("accepts the matching state", async () => {
      const { server, mcp, callback } = await pendingLogin({ state: "s-1" });
      expect(callback.get("state")).toBe("s-1");
      await mcp.finishAuth("svc", callback, { expectedState: "s-1" });
      expect(server.stats.exchanges).toBe(1);
    });

    it.each([
      ["missing", (params: URLSearchParams) => params.delete("state")],
      ["repeated", (params: URLSearchParams) => params.append("state", "s-1")],
      ["different", (params: URLSearchParams) => params.set("state", "s-2")],
    ])(
      "rejects a %s state before redeeming the code",
      async (_label, mutate) => {
        const { server, mcp, callback } = await pendingLogin({ state: "s-1" });
        mutate(callback);
        const error = await failure(
          mcp.finishAuth("svc", callback, { expectedState: "s-1" })
        );
        expect(error.message).toMatch(/state/);
        expect(server.stats.exchanges).toBe(0);
      }
    );

    it("defers to the SDK when omitted", async () => {
      const { server, mcp, callback } = await pendingLogin({ state: "s-1" });
      callback.set("state", "tampered");
      await mcp.finishAuth("svc", callback);
      expect(server.stats.exchanges).toBe(1);
    });

    it("rejects an empty expectedState up front", async () => {
      const { server, mcp, callback } = await pendingLogin({ state: "s-1" });
      await expect(
        mcp.finishAuth("svc", callback, { expectedState: "" })
      ).rejects.toThrow(/expectedState/);
      expect(server.stats.exchanges).toBe(0);
    });
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    "hints at discovery state when a callback fails (persisted: %s)",
    async (persistDiscovery, hinted) => {
      const { mcp, callback } = await pendingLogin({ persistDiscovery });
      callback.set("code", "bogus");
      const error = await failure(mcp.finishAuth("svc", callback));
      expect(error.cause).toBeDefined();
      expect(error.message.includes("saveDiscoveryState")).toBe(hinted);
    }
  );
});

describe("OAuth behavior on SDK 2.1", () => {
  it("lets the provider's token win over a stale configured Authorization after login", async () => {
    const server = await fixture();
    const provider = createTestOAuthProvider();
    const mcp = adapter({
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          headers: { Authorization: "Bearer stale" },
          authProvider: provider,
        },
      },
    });
    await failure(mcp.listTools());
    await mcp.finishAuth(
      "svc",
      await authorizeInBrowser(provider.redirects[0])
    );

    expect(hasWhoami(await mcp.listTools())).toBe(true);
    expect(provider.redirects).toHaveLength(1);
    const sent = server.requests
      .filter((request) => request.path === "/mcp")
      .map((request) => request.authorization);
    expect(sent[0]).toBe("Bearer stale");
    expect(sent.at(-1)).toBe(`Bearer ${provider.stored.tokens?.access_token}`);
  });

  it("gives a per-call provider precedence over a configured Authorization", async () => {
    const server = await fixture();
    const token = server.mintAccessToken();
    const mcp = adapter({
      servers: {
        svc: {
          transport: "http",
          url: server.mcpUrl,
          headers: { Authorization: "Bearer stale" },
        },
      },
    });
    await mcp.listToolsets({ authProvider: { token: async () => token } });
    const sent = server.requests
      .filter((request) => request.path === "/mcp")
      .map((request) => request.authorization);
    expect(new Set(sent)).toEqual(new Set([`Bearer ${token}`]));
  });

  it("refreshes an expired access token without a new redirect", async () => {
    const { server, provider, mcp, callback } = await pendingLogin();
    await mcp.finishAuth("svc", callback);
    const [tool] = (await mcp.listTools()).filter((t) =>
      t.name.endsWith("whoami")
    );

    server.expireAccessTokens();
    expect(JSON.stringify(await tool.invoke({}))).toContain("authorized");
    expect(server.stats.refreshes).toBe(1);
    expect(provider.redirects).toHaveLength(1);
  });

  it("keeps one connection per per-call provider", async () => {
    const server = await fixture();
    const [a, b] = [server.mintAccessToken(), server.mintAccessToken()];
    const providerA = { token: async () => a };
    const providerB = { token: async () => b };
    const mcp = adapter({
      servers: { svc: { transport: "http", url: server.mcpUrl } },
    });
    await mcp.listToolsets({ authProvider: providerA });
    await mcp.listToolsets({ authProvider: providerB });
    const sent = new Set(
      server.requests
        .filter((request) => request.path === "/mcp")
        .map((request) => request.authorization)
    );
    expect(sent).toEqual(new Set([`Bearer ${a}`, `Bearer ${b}`]));

    const clientA = await mcp.getClient("svc", { authProvider: providerA });
    const clientB = await mcp.getClient("svc", { authProvider: providerB });
    expect(clientA).toBeDefined();
    expect(clientB).toBeDefined();
    expect(clientA).not.toBe(clientB);
  });

  it("keeps the last spelling when one config repeats Authorization", async () => {
    const server = await fixture();
    await failure(
      adapter({
        servers: {
          svc: {
            transport: "http",
            url: server.mcpUrl,
            headers: { authorization: "Bearer a", Authorization: "Bearer b" },
          },
        },
      }).listTools()
    );
    expect(
      server.requests.find((request) => request.path === "/mcp")?.authorization
    ).toBe("Bearer b");
  });

  // Upstream #2510: the SDK cannot complete a mid-session redirect itself. A
  // stateless finishAuth lets the live connection pick up the new tokens.
  it("characterization: a login that lapses mid-session completes through finishAuth", async () => {
    const { server, provider, mcp, callback } = await pendingLogin();
    await mcp.finishAuth("svc", callback);
    const [tool] = (await mcp.listTools()).filter((t) =>
      t.name.endsWith("whoami")
    );

    server.revokeAll();
    await expect(tool.invoke({})).rejects.toThrow(/UnauthorizedError/);
    expect(provider.redirects).toHaveLength(2);

    await mcp.finishAuth(
      "svc",
      await authorizeInBrowser(provider.redirects[1])
    );
    expect(JSON.stringify(await tool.invoke({}))).toContain("authorized");
  });

  // Documented limitation (§4.5): rediscovering while a login is pending
  // starts a second redirect and replaces the PKCE verifier.
  it("characterization: rediscovering during a pending login invalidates the first callback", async () => {
    const { server, provider, mcp, callback } = await pendingLogin();
    await failure(mcp.listTools());
    expect(provider.redirects).toHaveLength(2);

    await failure(mcp.finishAuth("svc", callback));
    expect(server.stats.exchanges).toBe(0);
  });
});

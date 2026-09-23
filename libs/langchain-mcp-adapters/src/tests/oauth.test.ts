import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MCPAdapter, type MCPAdapterConfig } from "../index.js";
import {
  startOAuthFixture,
  type OAuthFixture,
  type OAuthFixtureOptions,
} from "./fixtures/oauth-server.js";

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

import { describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SSEClientTransport } from "@modelcontextprotocol/client";
import { ConnectionManager } from "../connection.js";
import { ConnectionSchema } from "../types.js";

/** An `authProvider` that holds one static token, the smallest shape the SDK adapts. */
const staticProvider = (token: string) =>
  ({
    get redirectUrl() {
      return "http://localhost/cb";
    },
    get clientMetadata() {
      return { redirect_uris: ["http://localhost/cb"] };
    },
    clientInformation: () => undefined,
    tokens: () => ({ access_token: token, token_type: "Bearer" }),
    saveTokens: () => {},
    redirectToAuthorization: () => {},
    saveCodeVerifier: () => {},
    codeVerifier: () => "verifier",
  }) as never;

/** Record what a transport actually puts on the wire. */
async function recordingServer(failFast = false): Promise<{
  url: string;
  seen: IncomingHttpHeaders[];
  server: Server;
}> {
  const seen: IncomingHttpHeaders[] = [];
  const server = createServer((req, res) => {
    seen.push(req.headers);
    if (failFast) {
      // Speak no MCP: the request headers are the subject, and a prompt
      // failure keeps the test off the handshake's timeout.
      res.writeHead(500).end();
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("event: endpoint\ndata: /messages\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/sse`, seen, server };
}

describe("what the transports send", () => {
  it("SSE: the SDK authorizes a connection with no custom fetch of ours", async () => {
    const { url, seen, server } = await recordingServer();
    const transport = new SSEClientTransport(new URL(url), {
      authProvider: staticProvider("from-provider"),
      requestInit: { headers: { "x-custom": "1" } },
    } as never);

    await transport.start();
    await transport.close();
    server.close();

    expect(seen[0].authorization).toBe("Bearer from-provider");
    expect(seen[0]["x-custom"]).toBe("1");
    expect(seen[0].accept).toContain("text/event-stream");
  });

  // Every spelling must land on the SDK's own, or the spread that builds a
  // transport's headers appends instead of replacing. Lower case is what
  // `mergeHeaders` produces; the others prove the fix canonicalises rather
  // than happening to agree.
  it.each([
    ["sse", "authorization"],
    ["sse", "Authorization"],
    ["sse", "AUTHORIZATION"],
    ["http", "authorization"],
    ["http", "Authorization"],
    ["http", "AUTHORIZATION"],
  ] as const)(
    "%s: a configured %s replaces the provider's, never joins it",
    async (transport, spelling) => {
      const { url, seen, server } = await recordingServer(true);
      const manager = new ConnectionManager();

      // Parsed, not hand-built: the connection schema is what canonicalises
      // header spelling, and every connection the adapter holds comes from it.
      const connection = {
        ...ConnectionSchema.parse({
          mode: "legacy",
          transport,
          url,
          automaticSSEFallback: false,
          headers: { [spelling]: "Bearer from-config" },
        }),
        authProvider: staticProvider("from-provider"),
      } as never;

      await manager.getOrCreateClient("svc", connection).catch(() => {
        // The recording server speaks no MCP; the request is what matters.
      });

      await manager.delete();
      server.close();

      expect(seen.length).toBeGreaterThan(0);
      expect(seen[0].authorization).toBe("Bearer from-config");
    }
  );
});

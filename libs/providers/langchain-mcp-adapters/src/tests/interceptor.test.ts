import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Server } from "node:http";
import { join } from "node:path";

import { createDummyHttpServer } from "./fixtures/dummy-http-server.js";
import { MultiServerMCPClient } from "../client.js";

type TransportKind = "stdio" | "http" | "sse";

class TestServers {
  private httpServers: Server[] = [];

  createStdio(name: string): { command: string; args: string[] } {
    const fixturePath = join(__dirname, "fixtures", "dummy-stdio-server.ts");
    return {
      command: "node",
      args: ["--import", "tsx", "--no-warnings", fixturePath, name],
    };
  }

  async createHTTP(
    name: string,
    opts?: { supportSSEFallback?: boolean; testHeaders?: boolean }
  ): Promise<{ baseUrl: string }> {
    return new Promise((resolve, reject) => {
      const app = createDummyHttpServer(name, {
        supportSSEFallback: Boolean(opts?.supportSSEFallback),
        testHeaders: Boolean(opts?.testHeaders),
      });
      const httpServer = app.listen(0, "127.0.0.1", (err?: Error) => {
        if (err) return reject(err);
        this.httpServers.push(httpServer);
        const { port } = httpServer.address() as { port: number };
        resolve({ baseUrl: `http://127.0.0.1:${port}` });
      });
    });
  }

  async cleanup(): Promise<void> {
    await Promise.all(
      this.httpServers.map(
        (srv) =>
          new Promise<void>((r) => {
            srv.close(() => r());
          })
      )
    );
    this.httpServers = [];
  }
}

describe("Interceptor hooks (stdio/http/sse)", () => {
  let servers: TestServers;

  beforeEach(() => {
    servers = new TestServers();
  });

  afterEach(async () => {
    await servers.cleanup();
  });

  const matrix: Array<{
    kind: TransportKind;
    setup: () => Promise<{ client: MultiServerMCPClient; serverName: string }>;
    supportsHeaders: boolean;
  }> = [
    {
      kind: "stdio",
      setup: async () => {
        const { command, args } = servers.createStdio("stdio-interceptor");
        const client = new MultiServerMCPClient({
          mcpServers: {
            stdio: {
              transport: "stdio",
              command,
              args,
            },
          },
          // global hooks
          beforeToolCall: ({ args }) => ({
            args: {
              ...((args as Record<string, unknown>) ?? {}),
              input: "global-mod",
            },
          }),
          afterToolCall: () => ({ result: ["global-after", []] }),
        });
        return { client, serverName: "stdio" };
      },
      supportsHeaders: false,
    },
    {
      kind: "http",
      setup: async () => {
        const { baseUrl } = await servers.createHTTP("http-interceptor", {
          testHeaders: true,
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            http: {
              transport: "http",
              url: `${baseUrl}/mcp`,
              automaticSSEFallback: true,
            },
          },
          beforeToolCall: ({ args }) => ({
            args: {
              ...((args as Record<string, unknown>) ?? {}),
              input: "global-mod",
            },
            header: { "X-Global": "1" },
          }),
          afterToolCall: () => ({ result: ["global-after", []] }),
        });
        return { client, serverName: "http" };
      },
      supportsHeaders: true,
    },
    {
      kind: "sse",
      setup: async () => {
        const { baseUrl } = await servers.createHTTP("sse-interceptor", {
          supportSSEFallback: true,
          testHeaders: true,
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            sse: {
              transport: "sse",
              url: `${baseUrl}/sse`,
            },
          },
          beforeToolCall: ({ args }) => ({
            args: {
              ...((args as Record<string, unknown>) ?? {}),
              input: "global-mod",
            },
            header: { "X-Global": "1" },
          }),
          afterToolCall: () => ({ result: ["global-after", []] }),
        });
        return { client, serverName: "sse" };
      },
      supportsHeaders: true,
    },
  ];

  describe.each(matrix)("$kind", ({ setup, supportsHeaders }) => {
    test("beforeToolCall modifies args (global and override)", async () => {
      const { client } = await setup();

      // Build a client that ONLY has beforeToolCall (no after), so we can inspect tool output
      const base = client.config;
      const clientGlobal = new MultiServerMCPClient({
        ...base,
        beforeToolCall: ({ args }: { args: unknown }) => ({
          args: {
            ...((args as Record<string, unknown>) ?? {}),
            input: "global-mod",
          },
        }),
        // ensure no global afterToolCall so tool returns raw JSON text we can parse
      } as never);

      try {
        const tools1 = await clientGlobal.getTools();
        const t1 = tools1.find((tool) => tool.name.includes("test_tool"))!;
        const out1 = (await t1.invoke({ input: "orig" })) as string;
        const parsed1 = JSON.parse(out1);
        expect(parsed1.input).toBe("global-mod");

        // Now override per-server to "server-mod" and verify it wins over global
        const cfg = clientGlobal.config;
        const serverKey = Object.keys(cfg.mcpServers)[0];
        cfg.mcpServers[serverKey].beforeToolCall = () => ({
          args: { input: "server-mod" },
        });
        const clientOverride = new MultiServerMCPClient(cfg);
        try {
          const tools2 = await clientOverride.getTools();
          const t2 = tools2.find((tool) => tool.name.includes("test_tool"))!;
          const out2 = (await t2.invoke({ input: "orig" })) as string;
          const parsed2 = JSON.parse(out2);
          expect(parsed2.input).toBe("server-mod");
        } finally {
          await clientOverride.close();
        }
      } finally {
        await clientGlobal.close();
        await client.close();
      }
    });
    test("beforeToolCall modifies args and server-specific overrides global", async () => {
      const { client } = await setup();

      // Invoke tool with server-specific hook via config on server
      // We pass server-specific hooks in constructor by using per-server config
      // so recreate client with server-specific overrides
      await client.close();
      const cfg = client.config;
      // augment server-specific before/after
      const serverKey = Object.keys(cfg.mcpServers)[0];
      cfg.mcpServers[serverKey] = {
        ...(cfg.mcpServers[serverKey] as unknown as Record<string, unknown>),
        beforeToolCall: () => ({ args: { input: "server-mod" } }),
        afterToolCall: () => ({ result: ["server-after", []] }),
      } as never;
      const client2 = new MultiServerMCPClient(cfg);
      try {
        const tools = await client2.getTools();
        const t = tools.find((tool) => tool.name.includes("test_tool"))!;
        const res = await t.invoke({ input: "orig" });
        expect(res).toBe("server-after");
      } finally {
        await client2.close();
      }
    });

    test("headers in beforeToolCall spawn new connection when supported", async () => {
      const { client } = await setup();
      try {
        if (!supportsHeaders) {
          // For stdio, attempting to set headers should cause a ToolException
          const cfg = client.config;
          const serverKey = Object.keys(cfg.mcpServers)[0];
          cfg.mcpServers[serverKey].beforeToolCall = () => ({
            header: { "X-StdIO": "1" },
          });
          const c3 = new MultiServerMCPClient(cfg);
          const stdioTools = await c3.getTools();
          const t = stdioTools.find((tool) => tool.name.includes("test_tool"))!;
          await expect(t.invoke({ input: "x" })).rejects.toThrow(
            /Forking stdio transport is not supported/
          );
          await c3.close();
        } else {
          // Override to set a concrete header and call header-checking tool
          const cfg = client.config;
          const serverKey = Object.keys(cfg.mcpServers)[0];
          cfg.mcpServers[serverKey].beforeToolCall = () => ({
            header: { "X-Check": "present" },
          });
          const c2 = new MultiServerMCPClient(cfg);
          const ts = await c2.getTools();
          const chk = ts.find((tool) => tool.name.includes("check_headers"));
          // call header checker
          const out = await chk!.invoke({ headerName: "X-Check" });
          expect(out).toBe("present");
          await c2.close();
        }
      } finally {
        await client.close();
      }
    });
  });

  test("onProgress and onLog hooks", async () => {
    const { baseUrl } = await servers.createHTTP("events-http", {
      testHeaders: false,
    });
    const logs: string[] = [];
    const progresses: number[] = [];
    const client = new MultiServerMCPClient({
      mcpServers: {
        http: {
          transport: "http",
          url: `${baseUrl}/mcp`,
          automaticSSEFallback: true,
        },
      },
      onLog: (log) => {
        const msg =
          (
            log as unknown as {
              params?: { message?: string };
              message?: string;
            }
          ).params?.message ??
          (log as unknown as { message?: string }).message ??
          "";
        logs.push(String(msg));
      },
      onProgress: (p) => {
        const anyP = p as unknown as {
          percentage?: number;
          progress?: number;
          total?: number;
        };
        let pct = anyP.percentage;
        if (pct == null && anyP.progress != null && anyP.total) {
          pct = Math.round((anyP.progress / anyP.total) * 100);
        }
        progresses.push(Number(pct ?? 0));
      },
    });
    try {
      const tools = await client.getTools();
      const t = tools.find((tool) => tool.name.includes("test_tool"))!;
      await t.invoke({ input: "evt" });
      expect(logs.some((m) => m.includes("test_tool invoked"))).toBe(true);
      expect(progresses).toEqual([33, 67, 100]);
    } finally {
      await client.close();
    }
  });
});

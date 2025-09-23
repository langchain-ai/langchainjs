import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Server } from "node:http";
import { join } from "node:path";
import { ToolMessage, BaseMessage } from "@langchain/core/messages";
import { createAgent, FakeToolCallingModel } from "langchain";
import type { RunnableConfig } from "@langchain/core/runnables";

import { createDummyHttpServer } from "./fixtures/dummy-http-server.js";
import { MultiServerMCPClient } from "../client.js";
import type { State } from "../hooks.js";
import type { ClientConfig } from "../types.js";

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
    setup: (
      params?: Partial<ClientConfig>
    ) => Promise<{ client: MultiServerMCPClient; serverName: string }>;
    supportsHeaders: boolean;
  }> = [
    {
      kind: "stdio",
      setup: async (params?: Partial<ClientConfig>) => {
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
          ...params,
        });
        return { client, serverName: "stdio" };
      },
      supportsHeaders: false,
    },
    {
      kind: "http",
      setup: async (params?: Partial<ClientConfig>) => {
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
          ...params,
        });
        return { client, serverName: "http" };
      },
      supportsHeaders: true,
    },
    {
      kind: "sse",
      setup: async (params?: Partial<ClientConfig>) => {
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
          ...params,
        });
        return { client, serverName: "sse" };
      },
      supportsHeaders: true,
    },
  ];

  describe.each(matrix)("$kind", ({ setup, supportsHeaders }) => {
    test("beforeToolCall modifies args", async () => {
      const { client } = await setup({
        afterToolCall: (res) => ({ result: res.result }),
      });

      try {
        const tools1 = await client.getTools();
        const t1 = tools1.find((tool) => tool.name.includes("test_tool"))!;
        const out1 = (await t1.invoke({ input: "orig" })) as string;
        const parsed1 = JSON.parse(out1);
        expect(parsed1.input).toBe("global-mod");
      } finally {
        await client.close();
      }
    });
    test("afterToolCall allows to modify tool result", async () => {
      const { client } = await setup();

      try {
        const tools = await client.getTools();
        const t = tools.find((tool) => tool.name.includes("test_tool"))!;
        const res = await t.invoke({ input: "orig" });
        expect(res).toBe("global-after");
      } finally {
        await client.close();
      }
    });

    test("headers in beforeToolCall spawn new connection when supported", async () => {
      const { client } = await setup({
        beforeToolCall: () => ({
          headers: { "X-Check": "present" },
        }),
        afterToolCall: (res) => ({ result: res.result }),
      });
      try {
        if (!supportsHeaders) {
          const stdioTools = await client.getTools();
          const t = stdioTools.find((tool) => tool.name.includes("test_tool"))!;
          await expect(t.invoke({ input: "x" })).rejects.toThrow(
            /Forking stdio transport is not supported/
          );
        } else {
          const ts = await client.getTools();
          const chk = ts.find((tool) => tool.name.includes("check_headers"));
          // call header checker
          const out = await chk!.invoke({ headerName: "X-Check" });
          expect(out).toBe("present");
        }
      } finally {
        await client.close();
      }
    });

    test("afterToolCall supports returning a ToolMessage", async () => {
      const { client } = await setup({
        afterToolCall: () => ({
          result: new ToolMessage({
            content: "server-after",
            tool_call_id: "test-tool-call-id",
          }),
        }),
      });

      try {
        const tools = await client.getTools();
        const t = tools.find((tool) => tool.name.includes("test_tool"))!;
        const res = await t.invoke({ input: "orig" });
        expect(res).toEqual([{ type: "text", text: "server-after" }]);
      } finally {
        await client.close();
      }
    });

    test("afterToolCall supports returning a string", async () => {
      const { client } = await setup({
        afterToolCall: () => ({
          result: "foobar",
        }),
      });

      try {
        const tools = await client.getTools();
        const t = tools.find((tool) => tool.name.includes("test_tool"))!;
        const res = await t.invoke({ input: "orig" });
        expect(res).toEqual("foobar");
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
      onMessage: (log) => {
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

  test("hooks have access to state and runtime without LangGraph", async () => {
    const { baseUrl } = await servers.createHTTP("http-interceptor", {
      testHeaders: true,
    });
    const stateCalls: State[] = [];
    const runtimeCalls: RunnableConfig[] = [];
    const client = new MultiServerMCPClient({
      mcpServers: {
        http: {
          transport: "http",
          url: `${baseUrl}/mcp`,
          automaticSSEFallback: true,
        },
      },
      beforeToolCall: (_, state, runtime) => {
        stateCalls.push(state);
        runtimeCalls.push(runtime);
      },
      afterToolCall: (_, state, runtime) => {
        stateCalls.push(state);
        runtimeCalls.push(runtime);
      },
    });

    try {
      const tools = await client.getTools();
      const t = tools.find((tool) => tool.name.includes("test_tool"))!;
      await t.invoke({ input: "orig" });
      expect(stateCalls).toHaveLength(2);
      expect(stateCalls).toEqual([{}, {}]);
      expect(runtimeCalls).toHaveLength(2);
      expect(runtimeCalls[0]).toEqual({
        tags: [],
        metadata: {},
        recursionLimit: 25,
        runName: "test_tool",
      });
    } finally {
      await client.close();
    }
  });

  test.only("hooks have access to state and runtime with LangGraph", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [[{ name: "test_tool", args: { input: "orig" }, id: "1" }]],
    });
    const { baseUrl } = await servers.createHTTP("http-interceptor", {
      testHeaders: true,
    });
    const stateCalls: { messages: BaseMessage[] }[] = [];
    const runtimeCalls: RunnableConfig[] = [];
    const client = new MultiServerMCPClient({
      mcpServers: {
        http: {
          transport: "http",
          url: `${baseUrl}/mcp`,
          automaticSSEFallback: true,
        },
      },
      beforeToolCall: (_, state, runtime) => {
        stateCalls.push(state as { messages: BaseMessage[] });
        runtimeCalls.push(runtime);
        return {
          args: {
            input: "I changed the input",
          },
        };
      },
      afterToolCall: (_, state, runtime) => {
        stateCalls.push(state as { messages: BaseMessage[] });
        runtimeCalls.push(runtime);
      },
    });

    try {
      const tools = await client.getTools();
      const agent = createAgent({
        llm: model,
        tools: tools,
      });
      const result = await agent.invoke({
        messages: [{ type: "user", content: "orig" }],
      });
      expect(stateCalls).toHaveLength(2);
      const [beforeState, afterState] = stateCalls;
      expect(beforeState.messages.length).toEqual(2);
      expect(afterState.messages.length).toEqual(2);
      expect(result.messages.pop()?.content).toEqual(
        `{"input":"I changed the input","serverName":"http-interceptor"}`
      );
      expect(result.messages.shift()?.content).toEqual("orig");
    } finally {
      await client.close();
    }
  });
});

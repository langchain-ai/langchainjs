import { afterEach, describe, expect, test, vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { MCPAdapter } from "../client.js";
import {
  ConnectionManager,
  type Client as ConnectedClient,
} from "../connection.js";
import { loadMcpTools } from "../tools.js";
import type { LoadMcpToolsOptions } from "../types.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function withProgressTool(
  options: LoadMcpToolsOptions,
  run: (context: {
    client: Client;
    tool: DynamicStructuredTool;
    started: Promise<void>;
    progress: (value: number) => Promise<void>;
    complete: () => void;
  }) => Promise<void>
) {
  const started = deferred();
  const completed = deferred();
  let progressToken: string | number | undefined;
  const server = new McpServer({ name: "progress", version: "1.0.0" });
  server.registerTool(
    "slow",
    { inputSchema: z.object({}) },
    async (_args, context) => {
      progressToken = context.mcpReq._meta?.progressToken;
      started.resolve();
      await completed.promise;
      return { content: [{ type: "text", text: "done" }] };
    }
  );
  const client = new Client({ name: "consumer", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  try {
    await client.connect(clientTransport);
    const [tool] = await loadMcpTools("worker", client, options);
    vi.useFakeTimers();
    await run({
      client,
      tool,
      started: started.promise,
      complete: completed.resolve,
      progress: async (value) => {
        expect(progressToken).toBeDefined();
        if (progressToken === undefined)
          throw new Error("Missing progress token");
        await server.server.notification({
          method: "notifications/progress",
          params: { progressToken, progress: value, total: 10 },
        });
      },
    });
  } finally {
    completed.resolve();
    await client.close();
    await server.close();
    vi.useRealTimers();
  }
}

afterEach(() => vi.restoreAllMocks());

describe("MCP progress timeouts", () => {
  test.each(["none", "observer", "throwing observer"] as const)(
    "resets the SDK timeout with %s",
    async (observer) => {
      const onProgress =
        observer === "none"
          ? undefined
          : vi.fn(() => {
              if (observer === "throwing observer")
                throw new Error("observer failed");
            });
      await withProgressTool(
        { resetTimeoutOnProgress: true, onProgress },
        async ({ tool, started, progress, complete }) => {
          const result = tool.invoke({}, { metadata: { timeoutMs: 100 } });
          const settled = vi.fn();
          result.then(settled, settled);
          await started;
          await vi.advanceTimersByTimeAsync(60);
          await progress(1);
          await vi.advanceTimersByTimeAsync(60);
          expect(settled).not.toHaveBeenCalled();
          complete();
          await expect(result).resolves.toBe("done");
          if (onProgress)
            expect(onProgress).toHaveBeenCalledWith(
              expect.objectContaining({ progress: 1 }),
              expect.objectContaining({ name: "slow", server: "worker" })
            );
        }
      );
    }
  );

  test.each([undefined, false])(
    "keeps the fixed timeout when reset is %s",
    async (reset) => {
      await withProgressTool(
        {
          onProgress: vi.fn(),
          ...(reset === undefined ? {} : { resetTimeoutOnProgress: reset }),
        },
        async ({ tool, started, progress }) => {
          const result = tool.invoke({}, { metadata: { timeoutMs: 100 } });
          const rejected = expect(result).rejects.toThrow(/timed out|timeout/i);
          await started;
          await vi.advanceTimersByTimeAsync(60);
          await progress(1);
          await vi.advanceTimersByTimeAsync(60);
          await rejected;
        }
      );
    }
  );

  test("still times out when progress stops", async () => {
    await withProgressTool(
      { resetTimeoutOnProgress: true },
      async ({ tool, started, progress }) => {
        const result = tool.invoke({}, { metadata: { timeoutMs: 100 } });
        const settled = vi.fn();
        result.then(settled, settled);
        await started;
        await vi.advanceTimersByTimeAsync(60);
        await progress(1);
        await vi.advanceTimersByTimeAsync(99);
        expect(settled).not.toHaveBeenCalled();
        const rejected = expect(result).rejects.toThrow(/timed out|timeout/i);
        await vi.advanceTimersByTimeAsync(2);
        await rejected;
      }
    );
  });

  test("allows cancellation after progress has extended the timeout", async () => {
    await withProgressTool(
      { resetTimeoutOnProgress: true },
      async ({ tool, started, progress }) => {
        const controller = new AbortController();
        const result = tool.invoke(
          {},
          { signal: controller.signal, metadata: { timeoutMs: 100 } }
        );
        const rejected = expect(result).rejects.toThrow("cancelled by caller");
        await started;
        await vi.advanceTimersByTimeAsync(60);
        await progress(1);
        await vi.advanceTimersByTimeAsync(60);
        controller.abort(new Error("cancelled by caller"));
        await rejected;
      }
    );
  });

  test("preserves the RunnableConfig timeout as an absolute deadline", async () => {
    await withProgressTool(
      { resetTimeoutOnProgress: true },
      async ({ tool, started, progress }) => {
        // AbortSignal.timeout uses native timers, independently of the SDK timer.
        vi.useRealTimers();
        const result = tool.invoke(
          {},
          { timeout: 200, metadata: { timeoutMs: 1000 } }
        );
        const rejected = expect(result).rejects.toThrow(
          /aborted due to timeout/i
        );
        await started;
        await progress(1);
        await rejected;
      }
    );
  });

  test.each([
    { global: true, server: undefined, expected: true },
    { global: true, server: false, expected: false },
    { global: false, server: true, expected: true },
  ])(
    "resolves global=$global and server=$server to $expected",
    async (settings) => {
      await withProgressTool({}, async ({ client, complete }) => {
        const connected: ConnectedClient = Object.assign(client, {
          fork: async (): Promise<ConnectedClient> => connected,
        });
        vi.spyOn(ConnectionManager.prototype, "get").mockReturnValue(connected);
        const callTool = vi.spyOn(client, "callTool");
        const adapter = new MCPAdapter({
          resetTimeoutOnProgress: settings.global,
          servers: {
            worker: {
              command: "unused",
              args: [],
              resetTimeoutOnProgress: settings.server,
            },
          },
        });
        try {
          const [tool] = await adapter.listTools();
          complete();
          await expect(tool.invoke({})).resolves.toBe("done");
          expect(callTool).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              resetTimeoutOnProgress: settings.expected,
            })
          );
        } finally {
          await adapter.close();
        }
      });
    }
  );
});

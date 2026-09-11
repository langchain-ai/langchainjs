import { MCPAdapter } from "../index.js";
import type {
  CallToolResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  LoggingMessageNotificationParams,
} from "@modelcontextprotocol/client";
import { test, expectTypeOf } from "vitest";
import { ToolMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MultiServerMCPClient } from "../client.js";
import type {
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
  CallToolResultContentType,
  ResolvedStreamableHTTPConnection,
  ResolvedStdioConnection,
} from "../types.js";

test("check tool hooks types", () => {
  new MultiServerMCPClient({
    mcpServers: {
      filesystem: {
        mode: "legacy",
        transport: "stdio",
        onMessage: (message, server) => {
          expectTypeOf(message.logger).toEqualTypeOf<string | undefined>();
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },
        onProgress: (progress, eventSource) => {
          expectTypeOf(progress).toMatchTypeOf<{
            percentage?: number;
            progress?: number;
            total?: number;
            message?: string;
          }>();
          expectTypeOf(eventSource).toEqualTypeOf<
            | {
                type: "tool";
                name: string;
                server: string;
                args: unknown;
              }
            | {
                type: "unknown";
              }
          >();
        },
        onCancelled: (notification, server) => {
          expectTypeOf(notification.reason).toEqualTypeOf<string | undefined>();
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },

        onInitialized: (server) => {
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },

        onPromptsListChanged: (server) => {
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },

        onResourcesListChanged: (server) => {
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },

        onResourcesUpdated: (notification, server) => {
          expectTypeOf(notification.uri).toEqualTypeOf<string>();
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },

        onToolsListChanged: (server) => {
          expectTypeOf(server).toEqualTypeOf<{
            server: string;
            options: ResolvedStreamableHTTPConnection | ResolvedStdioConnection;
          }>();
        },
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
      },
    },
    beforeToolCall: (toolCallRequest, state, runtime) => {
      expectTypeOf(state).toEqualTypeOf<unknown>();
      expectTypeOf(runtime).toEqualTypeOf<RunnableConfig>();
      expectTypeOf(toolCallRequest).toEqualTypeOf<{
        name: string;
        serverName: string;
        args: unknown;
      }>();
    },
    afterToolCall: (toolCallResult, state, runtime) => {
      expectTypeOf(state).toEqualTypeOf<unknown>();
      expectTypeOf(runtime).toEqualTypeOf<RunnableConfig>();
      expectTypeOf(toolCallResult.name).toEqualTypeOf<string>();
      expectTypeOf(toolCallResult.args).toEqualTypeOf<unknown>();
      expectTypeOf(toolCallResult.serverName).toEqualTypeOf<string>();
      return {
        result: new ToolMessage({
          content: "server-after",
          tool_call_id: "test-tool-call-id",
        }),
      };
    },
  });
});

test("canonical adapter API retains typed SDK callbacks and native tools", () => {
  const adapter = new MCPAdapter({
    servers: {
      remote: {
        transport: "http",
        url: "https://example.com/mcp",
        onMessage: (message) => {
          expectTypeOf(
            message
          ).toEqualTypeOf<LoggingMessageNotificationParams>();
        },
      },
    },
    beforeToolCall: async ({ args }) => {
      expectTypeOf(args).toEqualTypeOf<unknown>();

      return { args: { value: 1 } };
    },
  });

  expectTypeOf(adapter).toEqualTypeOf<MultiServerMCPClient>();
  expectTypeOf(adapter.close()).toEqualTypeOf<Promise<void>>();
});

test("resource and content types follow the SDK", () => {
  expectTypeOf<MCPResource>().toEqualTypeOf<
    ListResourcesResult["resources"][number]
  >();
  expectTypeOf<MCPResourceTemplate>().toEqualTypeOf<
    ListResourceTemplatesResult["resourceTemplates"][number]
  >();
  expectTypeOf<MCPResourceContent>().toEqualTypeOf<
    ReadResourceResult["contents"][number]
  >();
  expectTypeOf<CallToolResultContentType>().toEqualTypeOf<
    CallToolResult["content"][number]["type"]
  >();
});

test("protocol modes reject fields belonging to the other server interface", () => {
  // @ts-expect-error Legacy initialization observers are forbidden without legacy mode.
  const modern: import("../types.js").Connection = {
    url: "https://example.com/mcp",
    onInitialized: () => undefined,
  };

  const legacy: import("../types.js").Connection = {
    mode: "legacy",
    url: "https://example.com/mcp",
    onInitialized: () => undefined,
  };

  expectTypeOf(modern).toMatchTypeOf<import("../types.js").Connection>();
  expectTypeOf(legacy).toMatchTypeOf<import("../types.js").Connection>();
});

test("server resource subscriptions and modern reconnect boundaries", () => {
  new MCPAdapter({
    servers: {
      modern: {
        url: "https://example.com/mcp",
        resourceSubscriptions: ["test://resource"],
        onResourcesUpdated: ({ uri }) => {
          expectTypeOf(uri).toBeString();
        },
      },
      legacy: {
        mode: "legacy",
        url: "https://example.com/legacy",
        resourceSubscriptions: ["test://resource"],
        reconnect: { enabled: true },
      },
    },
  });

  const invalidModern = {
    servers: {
      modern: { url: "https://example.com/mcp", reconnect: { enabled: true } },
    },
  };

  // @ts-expect-error Modern transports cannot resume/replay lost streams.
  new MCPAdapter(invalidModern);

  const misplaced = {
    servers: { modern: { url: "https://example.com/mcp" } },
    resourceSubscriptions: ["test://resource"],
  };

  // @ts-expect-error Resource selection belongs to an individual server.
  new MCPAdapter(misplaced);
});

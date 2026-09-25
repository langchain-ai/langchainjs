import {
  MCPAdapter,
  type Connection,
  type ConnectionInit,
  type MCPAdapterConfig,
  type MCPAdapterInit,
  type SSEConnection,
  type SSEConnectionInit,
  type StdioConnection,
  type StdioConnectionInit,
  type _MCPAliases,
} from "../index.js";
import type {
  CallToolResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  LoggingMessageNotificationParams,
  Progress,
  ReadResourceResult,
  ResourceUpdatedNotificationParams,
} from "@modelcontextprotocol/client";
import { ToolMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { expectTypeOf, test } from "vitest";
import type { CallToolResultContentType, EventContext } from "../types.js";

type ServerMessageSource = {
  server: string;
  options: Connection;
};

test("notification callbacks retain their MCP payload and source types", () => {
  new MCPAdapter({
    servers: {
      modern: {
        transport: "http",
        url: "https://example.com/mcp",
        elicitation: true,
        resourceSubscriptions: ["test://resource"],
        onMessage: (message, source) => {
          expectTypeOf(
            message
          ).toEqualTypeOf<LoggingMessageNotificationParams>();
          expectTypeOf(message.logger).toEqualTypeOf<string | undefined>();
          expectTypeOf(source).toEqualTypeOf<ServerMessageSource>();
        },
        onProgress: (progress, source) => {
          expectTypeOf(progress).toEqualTypeOf<Progress>();
          expectTypeOf(source).toEqualTypeOf<EventContext>();
        },
        onPromptsListChanged: (source) => {
          expectTypeOf(source).toEqualTypeOf<ServerMessageSource>();
        },
        onResourcesListChanged: (source) => {
          expectTypeOf(source).toEqualTypeOf<ServerMessageSource>();
        },
        onResourcesUpdated: (resource, source) => {
          expectTypeOf(
            resource
          ).toEqualTypeOf<ResourceUpdatedNotificationParams>();
          expectTypeOf(resource.uri).toEqualTypeOf<string>();
          expectTypeOf(source).toEqualTypeOf<ServerMessageSource>();
        },
        onToolsListChanged: (source) => {
          expectTypeOf(source).toEqualTypeOf<ServerMessageSource>();
        },
      },
      legacy: {
        mode: "legacy",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        resourceSubscriptions: ["test://resource"],
        onInitialized: (source) => {
          expectTypeOf(source).toEqualTypeOf<ServerMessageSource>();
        },
        onElicitation: (request, context) => {
          expectTypeOf(request.message).toEqualTypeOf<string>();
          expectTypeOf(context.server).toEqualTypeOf<string>();
          expectTypeOf(context.signal).toEqualTypeOf<AbortSignal>();
          return { action: "cancel" };
        },
      },
    },
  });
});

test("tool hooks preserve request, state, config, and result types", () => {
  new MCPAdapter({
    servers: {
      local: {
        command: "node",
        args: ["server.js"],
      },
    },
    beforeToolCall: (request, state, config) => {
      expectTypeOf(request).toEqualTypeOf<{
        name: string;
        serverName: string;
        args: unknown;
      }>();
      expectTypeOf(state).toEqualTypeOf<unknown>();
      expectTypeOf(config).toEqualTypeOf<RunnableConfig>();
      return { args: { value: 1 } };
    },
    afterToolCall: (request, state, config) => {
      expectTypeOf(request.name).toEqualTypeOf<string>();
      expectTypeOf(request.serverName).toEqualTypeOf<string>();
      expectTypeOf(request.args).toEqualTypeOf<unknown>();
      expectTypeOf(state).toEqualTypeOf<unknown>();
      expectTypeOf(config).toEqualTypeOf<RunnableConfig>();
      return {
        result: new ToolMessage({
          content: "server-after",
          tool_call_id: "test-tool-call-id",
        }),
      };
    },
  });
});

test("simplified public input and resolved transport types", () => {
  const stdio = {
    command: "node",
    args: ["server.js"],
  } satisfies StdioConnectionInit;
  const http = { url: "https://example.com/mcp" } satisfies SSEConnectionInit;
  const named = {
    servers: { local: stdio, remote: http },
  } satisfies MCPAdapterInit;

  expectTypeOf(stdio).toMatchTypeOf<StdioConnectionInit>();
  expectTypeOf(http).toMatchTypeOf<SSEConnectionInit>();
  expectTypeOf<StdioConnection>().toMatchTypeOf<Connection>();
  expectTypeOf<SSEConnection>().toMatchTypeOf<Connection>();
  expectTypeOf<StdioConnectionInit>().toMatchTypeOf<ConnectionInit>();
  expectTypeOf<SSEConnectionInit>().toMatchTypeOf<ConnectionInit>();
  expectTypeOf<StdioConnection>().not.toMatchTypeOf<SSEConnection>();

  const namedAdapter = new MCPAdapter(named);
  expectTypeOf(namedAdapter.config).toMatchTypeOf<
    MCPAdapterConfig | Connection
  >();
  expectTypeOf(namedAdapter.config).not.toMatchTypeOf<ConnectionInit>();

  const directAdapter = new MCPAdapter("https://example.com/mcp");
  expectTypeOf(directAdapter.config).toMatchTypeOf<
    MCPAdapterConfig | Connection
  >();
});

test("SDK aliases and content types retain exact SDK identities", () => {
  expectTypeOf<_MCPAliases.MCPResource>().toEqualTypeOf<
    ListResourcesResult["resources"][number]
  >();
  expectTypeOf<_MCPAliases.MCPResourceTemplate>().toEqualTypeOf<
    ListResourceTemplatesResult["resourceTemplates"][number]
  >();
  expectTypeOf<_MCPAliases.MCPResourceContent>().toEqualTypeOf<
    ReadResourceResult["contents"][number]
  >();
  expectTypeOf<CallToolResultContentType>().toEqualTypeOf<
    CallToolResult["content"][number]["type"]
  >();
});

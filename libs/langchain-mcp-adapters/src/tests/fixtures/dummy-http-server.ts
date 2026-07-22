import { randomUUID } from "node:crypto";

import express, { type Express } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/server-legacy/sse";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import {
  McpServer,
  ResourceTemplate,
  isInitializeRequest,
} from "@modelcontextprotocol/server";
import { z } from "zod";

export function createDummyHttpServer(
  name: string,
  options: {
    testHeaders?: boolean;
    requireAuth?: boolean;
    supportSSEFallback?: boolean;
    disableStreamableHttp?: boolean;
  }
): Express {
  // Store captured headers per session
  const sessionHeaders: Record<string, Record<string, string>> = {};

  /**
   * Factory that creates a fresh McpServer instance.
   *
   * The MCP SDK enforces that a single McpServer / Protocol can only be
   * connected to **one** transport at a time.  For our test HTTP server we
   * need to accept many simultaneous sessions (streamable-HTTP) and SSE
   * connections, so we spin up a dedicated McpServer per transport.
   */
  function createMcpServerInstance(): McpServer {
    const server = new McpServer(
      { name, version: "1.0.0" },
      { capabilities: { logging: {} } }
    );

    // Add tools that can inspect request details
    // oxlint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - this may raise "Type instantiation is excessively deep and possibly infinite.ts(2589)"
    server.registerTool(
      "test_tool",
      {
        description: "A test tool that echoes input and request metadata",
        inputSchema: z.object({ input: z.string() }),
      },
      async ({ input }, ctx) => {
        // Logging message
        await server.server.notification(
          {
            method: "notifications/message",
            params: {
              level: "info",
              logger: "test_tool",
              data: `test_tool invoked with ${input}`,
            },
          },
          { relatedRequestId: ctx.mcpReq.id }
        );

        // Progress with token if present
        const progressToken = ctx.mcpReq._meta?.progressToken;
        if (progressToken !== undefined) {
          const steps = 3;
          for (let i = 1; i <= steps; i++) {
            await server.server.notification(
              {
                method: "notifications/progress",
                params: { progress: i, total: steps, progressToken },
              },
              { relatedRequestId: ctx.mcpReq.id }
            );
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                input,
                meta: ctx.mcpReq._meta,
                serverName: name,
              }),
            },
          ],
        };
      }
    );

    // oxlint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - this may raise "Type instantiation is excessively deep and possibly infinite.ts(2589)"
    server.registerTool(
      "sleep_tool",
      {
        description:
          "A test tool that sleeps for the given number of milliseconds before returning",
        inputSchema: z.object({ sleepMsec: z.number().int().positive() }),
      },
      async ({ sleepMsec }) => {
        await new Promise((resolve) => {
          setTimeout(resolve, sleepMsec);
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "done",
              }),
            },
          ],
        };
      }
    );

    if (options.testHeaders) {
      server.registerTool(
        "check_headers",
        {
          description: "Check if specific headers were received",
          inputSchema: z.object({ headerName: z.string() }),
        },
        async ({ headerName }, ctx) => {
          // Get headers for this session
          const sessionId = ctx.sessionId || "default";
          const headers = sessionHeaders[sessionId] || {};
          return {
            content: [
              {
                type: "text",
                text: headers[headerName.toLowerCase()] || "NOT_FOUND",
              },
            ],
          };
        }
      );
    }

    server.registerTool(
      "audio_tool",
      {
        description: "A tool that returns a dummy audio content.",
        inputSchema: z.object({
          input: z.string().describe("Some input string for the audio tool"),
        }),
      },
      async ({ input }) => {
        // Static base64 encoded minimal WAV file (1-byte silent audio)
        // This is a valid WAV file: RIFF header, WAVE format, fmt chunk (PCM, 44100Hz, 1 channel, 16-bit), data chunk (1 byte of 0x00)
        const base64Audio =
          "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

        return {
          content: [
            {
              type: "text",
              text: `Audio input was: ${input}, server: ${name}`,
            },
            {
              type: "audio",
              mimeType: "audio/wav",
              data: base64Audio,
            },
          ],
        };
      }
    );

    server.registerTool(
      "image_tool",
      {
        description: "A tool that returns a dummy image and text content.",
        inputSchema: z.object({
          input: z.string().describe("Some input string for the image tool"),
        }),
      },
      async ({ input }) => {
        // Static base64 encoded minimal PNG file (1x1 black pixel)
        const base64Image =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

        return {
          content: [
            {
              type: "text",
              text: `Image input was: ${input}, server: ${name}`,
            },
            {
              type: "image",
              mimeType: "image/png",
              data: base64Image,
            },
          ],
        };
      }
    );

    server.registerTool(
      "resource_tool",
      {
        description: "A tool that returns a dummy resource and text content.",
        inputSchema: z.object({
          input: z.string().describe("Some input string for the resource tool"),
        }),
      },
      async ({ input }) => {
        return {
          content: [
            {
              type: "text",
              text: `Resource input was: ${input}, server: ${name}`,
            },
            {
              type: "resource",
              resource: {
                uri: "mem://test.txt",
                mimeType: "text/plain",
                text: "This is a test resource.",
                // No blob, to test text-based resource handling
              },
            },
          ],
        };
      }
    );

    // Add a tool that returns structuredContent and _meta
    server.registerTool(
      "structured_tool",
      {
        description: "A tool that returns structuredContent and _meta",
        inputSchema: z.object({
          input: z.string().describe("Some input string"),
        }),
      },
      async ({ input }) => {
        return {
          content: [
            {
              type: "text",
              text: `Structured input was: ${input}`,
            },
          ],
          structuredContent: {
            type: "object",
            data: {
              result: "success",
              value: input,
              timestamp: new Date().toISOString(),
            },
          },
          _meta: {
            toolVersion: "1.0.0",
            serverName: name,
            executionTime: 100,
          },
        };
      }
    );

    // Add resource handlers
    server.registerResource(
      "test-resource",
      "mem://test.txt",
      {
        title: "Test Resource",
        description: "A test resource for testing resource listing and reading",
        mimeType: "text/plain",
      },
      async () => {
        return {
          contents: [
            {
              uri: "mem://test.txt",
              mimeType: "text/plain",
              text: "This is a test resource content.",
            },
          ],
        };
      }
    );

    server.registerResource(
      "data-resource",
      "mem://data.json",
      {
        title: "Data Resource",
        description: "A JSON data resource",
        mimeType: "application/json",
      },
      async () => {
        return {
          contents: [
            {
              uri: "mem://data.json",
              mimeType: "application/json",
              text: JSON.stringify({ key: "value", number: 42 }),
            },
          ],
        };
      }
    );

    // Add resource template
    server.registerResource(
      "user-profile",
      new ResourceTemplate("mem://user/{userId}/profile", { list: undefined }),
      {
        title: "User Profile Template",
        description: "A template for user profile resources",
      },
      async (uri, { userId }) => {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ userId, profile: "test profile" }),
            },
          ],
        };
      }
    );

    return server;
  }

  const app = express();
  app.use(express.json());

  // Store transports and metadata
  const transports = {
    streamable: {} as Record<string, NodeStreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>,
  };

  // Helper function to capture headers
  const captureHeaders = (req: express.Request, sessionId: string) => {
    if (options.testHeaders) {
      sessionHeaders[sessionId] = {};
      Object.keys(req.headers).forEach((key) => {
        if (req.headers[key]) {
          sessionHeaders[sessionId][key.toLowerCase()] = String(
            req.headers[key]
          );
        }
      });
    }
  };

  // Modern Streamable HTTP endpoint
  if (!options.disableStreamableHttp) {
    app.post("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: NodeStreamableHTTPServerTransport;

      if (options.requireAuth) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer test-token")) {
          res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Unauthorized" },
            id: null,
          });
          return;
        }
      }

      if (sessionId && transports.streamable[sessionId]) {
        transport = transports.streamable[sessionId];
        // Capture headers for existing session
        captureHeaders(req, sessionId);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new NodeStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.streamable[newSessionId] = transport;
            // Capture headers for new session
            captureHeaders(req, newSessionId);
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports.streamable[transport.sessionId];
            delete sessionHeaders[transport.sessionId];
          }
        };

        // Each transport gets its own McpServer instance because the SDK
        // only allows one connected transport per Protocol instance.
        const server = createMcpServerInstance();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    });

    // Handlers for GET and DELETE requests
    const handleSessionRequest = async (
      req: express.Request,
      res: express.Response
    ) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.streamable[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      const transport = transports.streamable[sessionId];
      // Capture headers for session request
      captureHeaders(req, sessionId);
      await transport.handleRequest(req, res);
    };

    app.get("/mcp", handleSessionRequest);
    app.delete("/mcp", handleSessionRequest);
  }

  // SSE endpoint for fallback testing
  if (options.supportSSEFallback) {
    app.get("/sse", async (req, res) => {
      if (options.requireAuth) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer test-token")) {
          res.status(401).send("Unauthorized");
          return;
        }
      }

      const transport = new SSEServerTransport("/messages", res);
      transports.sse[transport.sessionId] = transport;

      // Capture headers for SSE session
      captureHeaders(req, transport.sessionId);

      res.on("close", () => {
        delete transports.sse[transport.sessionId];
        delete sessionHeaders[transport.sessionId];
      });

      // Each transport gets its own McpServer instance because the SDK
      // only allows one connected transport per Protocol instance.
      const server = createMcpServerInstance();
      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports.sse[sessionId];
      if (transport) {
        // Capture headers for SSE message request
        captureHeaders(req, sessionId);
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send("No transport found for sessionId");
      }
    });
  }
  return app;
}

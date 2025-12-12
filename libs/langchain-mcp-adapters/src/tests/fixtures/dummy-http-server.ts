import { randomUUID } from "node:crypto";

// it's in dev dependencies - not sure why eslint gets mad here.
// eslint-disable-next-line import/no-extraneous-dependencies
import express, { type Express } from "express";

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v3";

export function createDummyHttpServer(
  name: string,
  options: {
    testHeaders?: boolean;
    requireAuth?: boolean;
    supportSSEFallback?: boolean;
    disableStreamableHttp?: boolean;
  }
): Express {
  const server = new McpServer(
    { name, version: "1.0.0" },
    { capabilities: { logging: {} } }
  );

  // Store captured headers per session
  const sessionHeaders: Record<string, Record<string, string>> = {};

  // Add tools that can inspect request details
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - this may raise "Type instantiation is excessively deep and possibly infinite.ts(2589)"
  server.tool(
    "test_tool",
    "A test tool that echoes input and request metadata",
    { input: z.string() },
    async ({ input }, extra) => {
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
        { relatedRequestId: extra.requestId }
      );

      // Progress with token if present
      const progressToken = extra._meta?.progressToken;
      if (progressToken !== undefined) {
        const steps = 3;
        for (let i = 1; i <= steps; i++) {
          await server.server.notification(
            {
              method: "notifications/progress",
              params: { progress: i, total: steps, progressToken },
            },
            { relatedRequestId: extra.requestId }
          );
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              input,
              meta: extra._meta,
              serverName: name,
            }),
          },
        ],
      };
    }
  );

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - this may raise "Type instantiation is excessively deep and possibly infinite.ts(2589)"
  server.tool(
    "sleep_tool",
    "A test tool that sleeps for the given number of milliseconds before returning",
    { sleepMsec: z.number().int().positive() },
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
    server.tool(
      "check_headers",
      "Check if specific headers were received",
      { headerName: z.string() },
      async ({ headerName }, extra) => {
        // Get headers for this session
        const sessionId = extra.sessionId || "default";
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

  server.tool(
    "audio_tool",
    "A tool that returns a dummy audio content.",
    // Input schema: a single string 'input'
    {
      input: z.string().describe("Some input string for the audio tool"),
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

  server.tool(
    "image_tool",
    "A tool that returns a dummy image and text content.",
    // Input schema: a single string 'input'
    {
      input: z.string().describe("Some input string for the image tool"),
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

  server.tool(
    "resource_tool",
    "A tool that returns a dummy resource and text content.",
    {
      input: z.string().describe("Some input string for the resource tool"),
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
  server.tool(
    "structured_tool",
    "A tool that returns structuredContent and _meta",
    {
      input: z.string().describe("Some input string"),
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

  const app = express();
  app.use(express.json());

  // Store transports and metadata
  const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
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
      let transport: StreamableHTTPServerTransport;

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
        transport = new StreamableHTTPServerTransport({
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

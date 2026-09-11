import express from "express";

import { McpServer, isInitializeRequest } from "@modelcontextprotocol/server";
import { randomUUID } from "node:crypto";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { SSEServerTransport } from "@modelcontextprotocol/server-legacy/sse";
import { z } from "zod/v4";

export async function main() {
  const server = new McpServer({
    name: "backwards-compatible-server",
    version: "1.0.0",
  });

  const calcSchema = z.object({ a: z.number(), b: z.number() });

  server.registerTool(
    "add",
    { description: "Adds two numbers together", inputSchema: calcSchema },
    async ({ a, b }) => {
      return {
        content: [{ type: "text", text: `${a + b}` }],
      };
    }
  );

  server.registerTool(
    "subtract",
    { description: "Subtracts two numbers", inputSchema: calcSchema },
    async ({ a, b }) => {
      return { content: [{ type: "text", text: `${a - b}` }] };
    }
  );

  server.registerTool(
    "multiply",
    { description: "Multiplies two numbers", inputSchema: calcSchema },
    async ({ a, b }) => {
      return { content: [{ type: "text", text: `${a * b}` }] };
    }
  );

  server.registerTool(
    "divide",
    { description: "Divides two numbers", inputSchema: calcSchema },
    async ({ a, b }) => ({ content: [{ type: "text", text: `${a / b}` }] })
  );

  const app = express();
  app.use(express.json());

  // Store transports for each session type
  const transports: {
    streamable: Record<string, NodeStreamableHTTPServerTransport>;
    sse: Record<string, SSEServerTransport>;
  } = { streamable: {}, sse: {} };

  // Streamable HTTP endpoint using legacy protocol sessions
  app.post("/mcp", async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: NodeStreamableHTTPServerTransport;

    if (sessionId && transports.streamable[sessionId]) {
      // Reuse existing transport
      transport = transports.streamable[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports.streamable[sessionId] = transport;
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports.streamable[transport.sessionId];
        }
      };

      // Connect to the MCP server
      await server.connect(transport);
    } else {
      // Invalid request
      console.error(
        "Invalid Streamable HTTP request: ",
        JSON.stringify(req.body, null, 2)
      );
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (
    req: express.Request,
    res: express.Response
  ) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.streamable[sessionId]) {
      console.error(
        "Invalid Streamable HTTP request (invalid/missing session ID): ",
        JSON.stringify(req.body, null, 2)
      );
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports.streamable[sessionId];
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  // Legacy SSE endpoint for older clients
  app.get("/sse", async (_req, res) => {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport("/messages", res);
    transports.sse[transport.sessionId] = transport;

    res.on("close", () => {
      delete transports.sse[transport.sessionId];
    });

    await server.connect(transport);
  });

  // Legacy message endpoint for older clients
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      console.error("No transport found for sessionId", sessionId);
      res.status(400).send("No transport found for sessionId");
    }
  });

  app.listen(3000);
}

if (typeof require !== "undefined" && require.main === module) {
  main().catch(console.error);
}

if (
  import.meta.url === process.argv[1] ||
  import.meta.url === `file://${process.argv[1]}`
) {
  main().catch(console.error);
}

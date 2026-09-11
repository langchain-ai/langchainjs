import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const serverName = process.argv[2] ?? "sdk1";

const server = new Server(
  { name: serverName, version: "1.30.0" },
  {
    capabilities: { tools: {}, resources: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ["test_tool", "legacy_tool"].map((name) => ({
    name,
    inputSchema: {
      type: "object",
      properties: { input: { type: "string" } },
      required: ["input"],
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [
    { type: "text", text: `${serverName}:${request.params.arguments?.input}` },
  ],
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ name: "legacy", uri: "test://legacy", mimeType: "text/plain" }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [
    { uri: request.params.uri, text: serverName, mimeType: "text/plain" },
  ],
}));

await server.connect(new StdioServerTransport());

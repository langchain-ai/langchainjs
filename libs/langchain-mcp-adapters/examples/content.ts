import { MCPAdapter } from "../src/index.js";

const adapter = new MCPAdapter({
  servers: { local: { url: "http://127.0.0.1:3001/mcp" } },
  afterToolCall: ({ result }) => {
    console.log("Model-facing LangChain content:", result[0]);
    console.log("MCP artifacts (structured data and metadata):", result[1]);
  },
});

try {
  const tools = await adapter.listTools();
  const inspect = tools.find((tool) => tool.name === "inspect");
  if (!inspect) throw new Error("Start modern_server.ts to provide inspect");
  await inspect.invoke({});
} finally {
  await adapter.close();
}

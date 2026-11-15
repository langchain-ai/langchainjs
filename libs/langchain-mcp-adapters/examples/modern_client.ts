import { MCPAdapter, type MCPAdapterConfig } from "../src/index.js";

const servers: MCPAdapterConfig["servers"] = {
  modern: { url: "http://127.0.0.1:3001/mcp" },
};

// Start calculator_server_shttp_sse.ts too, then pass --mixed.
if (process.argv.includes("--mixed")) {
  servers.legacy = { url: "http://localhost:3000/mcp" };
}

const adapter = new MCPAdapter({ servers, prefixToolNameWithServerName: true });
try {
  const tools = await adapter.listTools();
  const echo = tools.find((tool) => tool.name === "modern__echo");
  if (!echo) throw new Error("The modern server did not provide echo");
  console.log(await echo.invoke({ message: "Hello MCP" }));

  if (servers.legacy) {
    const add = tools.find((tool) => tool.name === "legacy__add");
    if (!add) throw new Error("The legacy server did not provide add");
    console.log(await add.invoke({ a: 2, b: 3 }));
  }
} finally {
  await adapter.close();
}

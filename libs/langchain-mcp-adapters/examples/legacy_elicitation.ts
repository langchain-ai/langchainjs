import { z } from "zod";
import { MCPAdapter } from "../src/index.js";

// Scripted consent for the local demo. Production applications collect the
// answer from their user and verify URL actions before returning accept.
const action = z
  .enum(["accept", "decline", "cancel"])
  .parse(process.argv[2] ?? "decline");
const adapter = new MCPAdapter({
  servers: {
    calculator: {
      mode: "legacy",
      url: "http://localhost:3000/mcp",
      onElicitation: (request, { signal }) => {
        signal.throwIfAborted();
        console.log(request.mode, request.message);
        if (request.mode === "url") console.log(request.url);
        return request.mode !== "url" && action === "accept"
          ? { action, content: { confirm: true } }
          : { action };
      },
    },
  },
});

try {
  const tools = await adapter.listTools();
  const approve = tools.find((tool) => tool.name === "approve");
  if (!approve)
    throw new Error("Start calculator_server_shttp_sse.ts to provide approve");
  console.log(await approve.invoke({ mode: "form" }));
  console.log(await approve.invoke({ mode: "url" }));
} finally {
  await adapter.close();
}

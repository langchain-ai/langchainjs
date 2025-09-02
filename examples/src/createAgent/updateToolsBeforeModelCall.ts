/**
 * Update Tools Before Model Call
 *
 * This feature allows dynamic modification of the available tool set before each model invocation, enabling
 * context-sensitive tool availability and adaptive functionality.
 *
 * Why this is important:
 * - Adaptive Tool Selection:
 *   Ensures only relevant tools are available based on current context, improving model focus and performance
 * - Security and Access Control:
 *   Dynamically restrict tool access based on user permissions or conversation state
 * - Performance Optimization:
 *   Reduces cognitive load on the model by presenting only contextually appropriate tools
 *
 * Goal: Dynamically adjust which tools are effectively "available" and update their descriptions
 * on each turn, based on evolving conversation state. This demonstrates changes during the
 * conversation (not static permissions) and shows how to inject context (e.g., file list)
 * into tool descriptions.
 *
 * Why this is important:
 * - Focus: Reduce tool surface area early, expand when user intent is clear
 * - Safety: Temporarily restrict powerful tools when not needed or after N calls
 * - UX: Keep tool descriptions up-to-date with contextual info (like available files)
 *
 * Example Scenario:
 * Build a small file assistant with two tools: `list_files` and `read_file`.
 * - Turn 1: only `list_files` is enabled.
 * - Turns 2–3: enable `read_file` once intent is clear.
 * - Turn 4+: restrict back to `list_files` (simulate cooldown/rate limiting).
 * - Each turn, update the `read_file` description to include the current file list.
 */

import fs from "node:fs/promises";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Tiny in-memory file system for the example
 */
const files = ["README.md", "notes.txt", "report.pdf"] as const;
const fileContents: Record<(typeof files)[number], string> = {
  "README.md":
    "Welcome to the demo. Use list_files then read_file to view content.",
  "notes.txt": "Today: demo dynamic tool availability and descriptions.",
  "report.pdf": "(binary content placeholder)",
};

/**
 * Evolving session state (resets per run)
 */
const sessionState = {
  callCount: 0,
  enabled: new Set<string>(["list_files"]), // start minimal: only list
};

/**
 * Tools
 */
const listFilesTool = tool(
  async () => {
    return `Available files:\n- ${files.join("\n- ")}`;
  },
  {
    name: "list_files",
    description: "List the available files in the project.",
    schema: z.object({}),
  }
);

const readFileTool = tool(
  async (input: { filename: string }) => {
    const name = input.filename as (typeof files)[number];
    if (
      !(files as readonly string[]).includes(input.filename) ||
      !fileContents[name]
    ) {
      return `File not found: ${input.filename}`;
    }
    return fileContents[name];
  },
  {
    name: "read_file",
    description: "Read a file by exact name (see list_files for options).",
    schema: z.object({ filename: z.string().describe("Exact file name") }),
  }
);

/**
 * Helper: update which tools are enabled and descriptions before each model call
 *
 * - Turn 1: only list_files
 * - Turns 2-3: list_files + read_file (after user intent emerges)
 * - Turn 4+: restrict back to list_files (simulate rate-limiting or cooldown)
 * - Also inject current file list into read_file description each turn
 */
function updateToolAvailabilityAndDescriptions() {
  sessionState.callCount += 1;
  sessionState.enabled.clear();

  if (sessionState.callCount === 1) {
    sessionState.enabled.add("list_files");
  } else if (sessionState.callCount <= 3) {
    sessionState.enabled.add("list_files");
    sessionState.enabled.add("read_file");
  } else {
    sessionState.enabled.add("list_files");
  }

  // Dynamically update read_file description with the current file list
  readFileTool.description = `Read a file by exact name. Currently available files:\n- ${files.join(
    "\n- "
  )}\n(Use list_files first if unsure.)`;

  // Indicate disabled tools in their descriptions (LLM guidance)
  listFilesTool.description = sessionState.enabled.has("list_files")
    ? "List the available files in the project."
    : "(Disabled) List the available files in the project.";
  readFileTool.description = sessionState.enabled.has("read_file")
    ? readFileTool.description
    : `(Disabled) ${readFileTool.description}`;

  console.log(
    `\n🛠️ Active tools this turn: ${[...sessionState.enabled].join(
      ", "
    )} (turn ${sessionState.callCount})`
  );
}

/**
 * Agent
 *
 * Keep the full tool list static, but update descriptions and guide the model via a system message
 * about which tools are currently enabled. This avoids re-binding a different tool set every turn,
 * while still achieving the desired behavior.
 */
const agent = createAgent({
  llm: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
  tools: [listFilesTool, readFileTool],
  preModelHook: (state) => {
    updateToolAvailabilityAndDescriptions();

    /**
     * Add a guidance system message describing current availability
     */
    const enabledNow = [...sessionState.enabled];
    const guidance = `Tool availability this turn: ${enabledNow.join(
      ", "
    )}. Only call enabled tools. If read_file is disabled, list files first and ask the user to confirm.`;

    return {
      ...state,
      messages: [{ role: "system", content: guidance }, ...state.messages],
    };
  },
  prompt: `You are a file assistant. Use tools thoughtfully.
- On the first turn, only list_files will be enabled.
- On later turns, read_file may become enabled. If disabled, guide the user to list files or confirm.
- Keep answers concise.`,
});

/**
 * Demo
 */
console.log("=== Dynamic Tool Availability & Descriptions (Simple) ===");

// 1) First turn → only list_files enabled
const turn1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "Please read notes.txt",
    },
  ],
});
console.log("Turn 1:", turn1.messages.at(-1)?.content);

// 2) Second turn → read_file becomes enabled
const turn2 = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "Now read notes.txt",
    },
  ],
});
console.log("Turn 2:", turn2.messages.at(-1)?.content);

// 3) Third turn → still enabled
const turn3 = await agent.invoke({
  messages: [{ role: "user", content: "Read README.md" }],
});
console.log("Turn 3:", turn3.messages.at(-1)?.content);

// 4) Fourth turn → restrict back to only list_files
const turn4 = await agent.invoke({
  messages: [{ role: "user", content: "Read report.pdf" }],
});
console.log("Turn 4:", turn4.messages.at(-1)?.content);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

/**
 * Example Output:
 * 🛠️ Active tools this turn: list_files (turn 1)
 *
 * 🛠️ Active tools this turn: list_files, read_file (turn 2)
 *
 * 🛠️ Active tools this turn: list_files, read_file (turn 3)
 * Turn 1: The content of `notes.txt` is: "Today: demo dynamic tool availability and descriptions."
 *
 * 🛠️ Active tools this turn: list_files (turn 4)
 *
 * 🛠️ Active tools this turn: list_files (turn 5)
 * Turn 2: The file "notes.txt" is available. Please confirm if you would like me to read it.
 *
 * 🛠️ Active tools this turn: list_files (turn 6)
 *
 * 🛠️ Active tools this turn: list_files (turn 7)
 * Turn 3: The file "README.md" is available. Please confirm if you would like to proceed with reading it.
 *
 * 🛠️ Active tools this turn: list_files (turn 8)
 *
 * 🛠️ Active tools this turn: list_files (turn 9)
 * Turn 4: The file "report.pdf" is available. However, I currently can't read it directly. Would you like to list the files again or confirm any other action?
 */

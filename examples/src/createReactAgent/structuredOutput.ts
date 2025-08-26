import fs from "fs/promises";
import { createReactAgent, tool, HumanMessage } from "langchain";

import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

const sumTool = tool(({ a, b }: { a: number; b: number }) => a + b, {
  name: "sum",
  description: "Sum two numbers",
  schema: z.object({
    a: z.number(),
    b: z.number(),
  }),
});

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [sumTool],
  responseFormat: z.object({
    result: z.number(),
  }),
});

const response = await agent.invoke({
  messages: [new HumanMessage("What's the sum of 1 and 2?")],
});

/**
 * Expected output: 3
 */
console.log(response.structuredResponse.result);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

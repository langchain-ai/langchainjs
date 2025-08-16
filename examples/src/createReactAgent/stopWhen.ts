import fs from "fs/promises";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  createReactAgent,
  tool,
  HumanMessage,
  stopWhenToolCall,
} from "langchain";

/**
 * A deterministic poll tool: returns "pending" for the first 10 calls, then "succeeded".
 * @returns A tool that polls a job and returns the status and number of attempts.
 */
function makePollTool() {
  let attempts = 0;
  return tool(
    async () => {
      attempts += 1;
      console.log("pollJob", attempts);
      return { status: attempts >= 10 ? "succeeded" : "pending", attempts };
    },
    {
      name: "pollJob",
      description:
        "Check the status of a long-running job. Returns { status: 'pending' | 'succeeded', attempts: number }.",
      schema: z.object({}), // no args
    }
  );
}
const pollJob = makePollTool();
const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

const agent = createReactAgent({
  llm,
  tools: [pollJob],
  stopWhen: [stopWhenToolCall("pollJob", 3)],
  responseFormat: z.object({
    attempts: z.number(),
    succeeded: z.boolean(),
  }),
  // Keep the prompt super explicit so the model actually loops via the tool:
  prompt: `You are a strict polling bot.
- Only use the "pollJob" tool until it returns { status: "succeeded" }.
- If status is "pending", call the tool again. Do not produce a final answer.
- When it is "succeeded", return exactly: "Attempts: <number>" with no extra text.`,
});

const response = await agent.invoke({
  messages: [
    new HumanMessage(
      "Poll the job until it's done and tell me how many attempts it took."
    ),
  ],
});

/**
 * Expected Output:
 * `{ attempts: 3, succeeded: false }`
 */
console.log("Last Message", response.messages.at(-1)?.content);
console.log("Structured Response", response.structuredResponse);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

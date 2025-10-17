/**
 * Example demonstrating the Code Execution Middleware with OpenAI.
 *
 * This middleware enables GPT models to execute code in a sandboxed container,
 * analyze uploaded files, and generate output files. The example demonstrates
 * multi-turn conversation with container and file state persistence.
 */

import { OpenAIContainerProvider } from "@langchain/openai/middleware";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import {
  codeExecutionMiddleware,
  createAgent,
  MemoryFileProvider,
} from "langchain";
import fs from "node:fs/promises";
import { join } from "node:path";

// Initial setup
const model = new ChatOpenAI({
  model: "gpt-4.1",
  useResponsesApi: true,
});

const middleware = codeExecutionMiddleware(
  new OpenAIContainerProvider(),
  new MemoryFileProvider()
);

const agent = createAgent({
  model,
  middleware: [middleware],
  checkpointer: new MemorySaver(),
});

const thread = {
  configurable: {
    thread_id: "test-123",
  },
};

// Read and add the test data file
const testDataPath = "test_data.csv";
const fileContent = await fs.readFile(testDataPath);

// First invocation - should create container and analyze uploaded data
const response1 = await agent.invoke(
  {
    messages: new HumanMessage("Filter to just widget A"),
    files: [await middleware.addFile(testDataPath, fileContent)],
  },
  thread
);
console.log("Response 1:", response1.messages);

// Second invocation - should reuse container and previous analysis
const response2 = await agent.invoke(
  {
    messages: new HumanMessage(
      "Turn that into a graph of sales and units over time."
    ),
  },
  thread
);
console.log("Response 2:", response2.messages);

// Extract and download generated files
const generatedFiles = middleware
  .files(response2)
  .filter(({ type, path }) => type === "tool" && path.endsWith(".png"));

for (const file of generatedFiles) {
  const content = await file.getContent();
  const outputPath = join(".", file.path);
  await fs.writeFile(outputPath, content);
  console.log(`Downloaded generated file: ${outputPath}`);
}

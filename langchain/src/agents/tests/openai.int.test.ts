/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { z } from "zod";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { Calculator } from "../../tools/calculator.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { DynamicStructuredTool } from "../../tools/dynamic.js";

test("OpenAIAgent", async () => {
  const executor = await initializeAgentExecutorWithOptions(
    [
      new Calculator(),
      new SerpAPI(process.env.SERPAPI_API_KEY, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us",
      }),
    ],
    new ChatOpenAI({ modelName: "gpt-4-0613", temperature: 0 }),
    {
      agentType: "openai-functions",
      verbose: true,
    }
  );

  const result = await executor.run("What is the weather in New York?", {
    metadata: {
      more: "metadata",
    },
  });

  console.log(result);

  const result2 = await executor.run(
    "And what is the weather like in the capital of that state?"
  );

  console.log(result2);
});

test("OpenAIAgent streaming", async () => {
  const executor = await initializeAgentExecutorWithOptions(
    [
      new Calculator(),
      new SerpAPI(process.env.SERPAPI_API_KEY, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us",
      }),
    ],
    new ChatOpenAI({
      modelName: "gpt-4-0613",
      temperature: 0,
      streaming: true,
    }),
    {
      agentType: "openai-functions",
      returnIntermediateSteps: true,
      maxIterations: 3,
    }
  );

  const result = await executor.call({
    input: "What is the weather in New York?",
  });

  console.log(result);
});

test("OpenAIAgent with parsing error handling", async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new DynamicStructuredTool({
      name: "animal-picker",
      description: "Picks animals",
      schema: z.object({
        animal: z
          .object({
            name: z.string().describe("The name of the animal"),
            friendliness: z
              .enum(["earth", "wind", "fire"])
              .describe("How friendly the animal is."),
          })
          .describe("The animal to choose"),
      }),
      func: async (input: { animal: object }) => JSON.stringify(input)
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    verbose: true,
    handleParsingErrors:
      "Please try again, paying close attention to the allowed enum values",
  });
  console.log("Loaded agent.");

  const input = `Please choose an aquatic animal and call the provided tool, returning how friendly it is.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });

  console.log({ result });
});

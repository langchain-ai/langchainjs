/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { Calculator } from "../../tools/calculator.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { ChatOpenAI } from "../../chat_models/openai.js";

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

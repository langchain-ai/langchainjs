/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SystemMessage } from "../../schema/index.js";
import { Tool } from "../../tools/base.js";
import { Calculator } from "../../tools/calculator.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";

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

test("OpenAIAgent code interpreter", async () => {
  class PythonTool extends Tool {
    name = "python";

    description = `Input a string of code to a python interpreter (jupyter kernel). `;

    private async run(code: string) {
      console.log("run code: ", code);
      // simulation code running results
      return ":)";
    }

    async _call(code: string) {
      const output = await this.run(code);
      return output;
    }
  }

  const executor = await initializeAgentExecutorWithOptions(
    [new PythonTool()],
    new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      streaming: true,
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    {
      agentType: "openai-functions",
      returnIntermediateSteps: true,
      maxIterations: 1,
      agentArgs: {
        systemMessage: new SystemMessage(
          `You are a Assistant is called "Code Interpreter" and capable of using a python code interpreter (sandboxed jupyter kernel) to run code`
        ),
      },
    }
  );

  const result = await executor.call({
    input: "Plot a sin wave and show it to me.",
  });

  console.log(result);
});

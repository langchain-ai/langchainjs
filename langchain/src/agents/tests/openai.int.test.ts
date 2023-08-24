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
  const model = new ChatOpenAI({ temperature: 0.1 });
  const tools = [
    new DynamicStructuredTool({
      name: "task-scheduler",
      description: "Schedules tasks",
      schema: z
        .object({
          tasks: z
            .array(
              z.object({
                title: z
                  .string()
                  .describe("The title of the tasks, reminders and alerts"),
                due_date: z
                  .string()
                  .describe("Due date. Must be a valid JavaScript date string"),
                task_type: z
                  .enum([
                    "Call",
                    "Message",
                    "Todo",
                    "In-Person Meeting",
                    "Email",
                    "Mail",
                    "Text",
                    "Open House",
                  ])
                  .describe("The type of task"),
              })
            )
            .describe("The JSON for task, reminder or alert to create"),
        })
        .describe("JSON definition for creating tasks, reminders and alerts"),
      func: async (input: { tasks: object }) => JSON.stringify(input),
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    verbose: true,
    handleParsingErrors:
      "Please try again, paying close attention to the allowed enum values",
  });
  console.log("Loaded agent.");

  const input = `Set a reminder to renew our online property ads next week.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });

  console.log({ result });
});

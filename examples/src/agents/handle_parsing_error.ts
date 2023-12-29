import { z } from "zod";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "langchain/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from "langchain/hub";

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

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  handleParsingErrors:
    "Please try again, paying close attention to the allowed enum values",
});

console.log("Loaded agent.");

const input = `Set a reminder to renew our online property ads next week.`;

console.log(`Executing with input "${input}"...`);

const result = await agentExecutor.invoke({ input });

console.log({ result });

/*
  {
    result: {
      input: 'Set a reminder to renew our online property ads next week.',
      output: 'I have set a reminder for you to renew your online property ads on October 10th, 2022.'
    }
  }
*/

import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new DynamicTool({
      name: "FOO",
      description:
        "call this to get the value of foo. input should be an empty string.",
      func: () =>
        new Promise((resolve) => {
          resolve("foo");
        }),
    }),
    new DynamicTool({
      name: "BAR",
      description:
        "call this to get the value of bar. input should be an empty string.",
      func: () =>
        new Promise((resolve) => {
          resolve("baz1");
        }),
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
  });

  console.log("Loaded agent.");

  const input = `What is the value of foo?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });

  console.log(`Got output ${result.output}`);
};

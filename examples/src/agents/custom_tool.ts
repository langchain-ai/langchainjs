import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
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

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description"
  );

  console.log("Loaded agent.");

  const input = `What is the value of foo?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};

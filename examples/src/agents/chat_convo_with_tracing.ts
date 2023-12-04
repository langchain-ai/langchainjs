import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

export const run = async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  // Passing "chat-conversational-react-description" as the agent type
  // automatically creates and uses BufferMemory with the executor.
  // If you would like to override this, you can pass in a custom
  // memory option, but the memoryKey set on it must be "chat_history".
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const input0 = "hi, i am bob";

  const result0 = await executor.invoke({ input: input0 });

  console.log(`Got output ${result0.output}`);

  const input1 = "whats my name?";

  const result1 = await executor.invoke({ input: input1 });

  console.log(`Got output ${result1.output}`);

  const input2 = "whats the weather in pomfret?";

  const result2 = await executor.invoke({ input: input2 });

  console.log(`Got output ${result2.output}`);
};

import { test } from "@jest/globals";
import { BraveSearch } from "../brave_search.js";
import { Calculator } from "../calculator.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";

test("BraveSearchTool", async () => {
  const tool = new BraveSearch();

  const result = await tool.call("What is Langchain?");

  console.log({ result });
});

test("Run in an agent", async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [new BraveSearch(), new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-zero-shot-react-description",
    verbose: true,
  });

  const input = `Who is Dua Lipa's boyfriend? What is his current age raised to the 0.23 power?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
});

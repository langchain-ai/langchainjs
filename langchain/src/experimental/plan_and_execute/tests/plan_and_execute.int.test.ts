/* eslint-disable no-process-env */
import { PlanAndExecuteAgentExecutor } from "../agent_executor.js";
import { Calculator } from "../../../tools/calculator.js";
import { ChatOpenAI } from "../../../chat_models/openai.js";
import { SerpAPI } from "../../../tools/serpapi.js";

test("Run agent on a simple input", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools,
  });

  const result = await executor.call({
    input: `What is 80 raised to the second power?`,
  });

  console.log({ result });
});

test.skip("Run agent", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools,
  });

  const result = await executor.call({
    input: `Who is the current president of the United States? What is their current age raised to the second power?`,
  });

  console.log({ result });
});

// TODO: Improve prompt to store compressed context to support this input
test.skip("Run agent with a sequential math problem", async () => {
  const tools = [new Calculator()];
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools({
    llm: model,
    tools,
  });

  const result = await executor.call({
    input: `In a dance class of 20 students, 20% enrolled in contemporary dance, 25% of the remaining enrolled in jazz dance, and the rest enrolled in hip-hop dance. What percentage of the entire students enrolled in hip-hop dance?`,
  });

  console.log(result);
});

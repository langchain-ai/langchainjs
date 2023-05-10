/* eslint-disable no-process-env */
import { Tool } from "../../../tools/base.js";
import { PlanAndExecuteAgentExecutor } from "../agent_executor.js";
import { Calculator } from "../../../tools/calculator.js";
import { ChatOpenAI } from "../../../chat_models/openai.js";
import { SerpAPI } from "../../../tools/serpapi.js";

test.only("Run agent", async () => {
  const tools: Tool[] = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools(model, tools);

  const result = await executor.call({
    input: `Who is Leo DiCaprio's girlfriend? What is her current age raised to the 0.43 power?`,
  });

  console.log(result);
});

test("Run agent", async () => {
  const tools: Tool[] = [new Calculator()];
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    verbose: true,
  });
  const executor = PlanAndExecuteAgentExecutor.fromLLMAndTools(model, tools);

  const result = await executor.call({
    input: `In a dance class of 20 students, 20% enrolled in contemporary dance, 25% of the remaining enrolled in jazz dance, and the rest enrolled in hip-hop dance. What percentage of the entire students enrolled in hip-hop dance?`,
  });

  console.log(result);
});

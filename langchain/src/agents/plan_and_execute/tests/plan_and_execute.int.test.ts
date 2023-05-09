/* eslint-disable no-process-env */
// import { OpenAI } from "../../../llms/openai.js";
import { Tool } from "../../../tools/base.js";
import { PlanAndExecuteAgentExecutor } from "../agent_executor.js";
import { PlanAndExecuteAgent } from "../index.js";
import { Calculator } from "../../../tools/calculator.js";
import { ChatOpenAI } from "../../../chat_models/openai.js";
import { SerpAPI } from "../../../tools/serpapi.js";

test.only("Run agent", async () => {
  const tools: Tool[] = [new Calculator(), new SerpAPI()]
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-3.5-turbo", verbose: true });
  const executor = new PlanAndExecuteAgentExecutor({
    agent: PlanAndExecuteAgent.fromLLMAndTools(
      model,
      tools
    ),
    tools
  });

  const result = await executor.call({
    input: `what is leo di caprios girlsfriend age raised to the .43 power`
  });

  console.log(result);
});

test("Run agent", async () => {
  const tools: Tool[] = [new Calculator()]
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-3.5-turbo", verbose: true });
  const executor = new PlanAndExecuteAgentExecutor({
    agent: PlanAndExecuteAgent.fromLLMAndTools(
      model,
      tools
    ),
    tools
  });

  const result = await executor.call({
    input: `In a dance class of 20 students, 20% enrolled in contemporary dance, 25% of the remaining enrolled in jazz dance, and the rest enrolled in hip-hop dance. What percentage of the entire students enrolled in hip-hop dance?`
  });

  console.log(result);

  // const tools = [
  //   new SerpAPI(undefined, {
  //     location: "Austin,Texas,United States",
  //     hl: "en",
  //     gl: "us",
  //   }),
  //   new Calculator(),
  //   new DynamicTool({
  //     name: "foo",
  //     description: "Some other tool that does foo",
  //     func: async () => "bar",
  //   }),
  // ];

  // const executor = await initializeAgentExecutorWithOptions(tools, model, {
  //   agentType: "zero-shot-react-description",
  // });

  // const input = `What is the weather like in Washington DC?`;
  // console.log(`Executing with input "${input}"...`);

  // const result = await executor.call({ input });

  // console.log(`Got output ${result.output}`);
});

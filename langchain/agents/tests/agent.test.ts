import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai";
import { loadAgent } from "../load";
import { AgentExecutor, Tool } from "../index";
import { SerpAPI } from "../tools/serpapi";
import { Calculator } from "../tools/calculator";

test("Run agent from hub", async () => {
  const model = new OpenAI({});
  const tools: Tool[] = [new SerpAPI(), new Calculator()];
  const agent = await loadAgent(
    "lc://agents/zero-shot-react-description/agent.json",
    { llm: model, tools }
  );
  const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
  const res = await executor.call({
    input:
      "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?",
  });
  console.log(res);
}, 30000);

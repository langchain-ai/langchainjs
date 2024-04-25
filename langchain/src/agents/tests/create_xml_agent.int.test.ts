import { test, expect } from "@jest/globals";
import type { PromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { pull } from "../../hub.js";
import { AgentExecutor, createXmlAgent } from "../index.js";
import { ChatAnthropic } from "../../chat_models/anthropic.js";

const tools = [new TavilySearchResults({ maxResults: 1 })];

test("createXmlAgent works", async () => {
  const prompt = await pull<PromptTemplate>("hwchase17/xml-agent-convo");
  const llm = new ChatAnthropic({
    modelName: "claude-2",
    temperature: 0,
  });
  const agent = await createXmlAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  const input = "what is LangChain?";
  const result = await agentExecutor.invoke({
    input,
  });

  console.log(result);

  expect(result.input).toBe(input);
  expect(typeof result.output).toBe("string");
  // Length greater than 10 because any less than that would warrant
  // an investigation into why such a short generation was returned.
  expect(result.output.length).toBeGreaterThan(10);
});

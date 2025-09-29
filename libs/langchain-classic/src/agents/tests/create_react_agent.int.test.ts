import { test, expect } from "@jest/globals";
import { OpenAI } from "@langchain/openai";
import type { PromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "../../util/testing/tools/tavily_search.js";
import { pull } from "../../hub/index.js";
import { AgentExecutor, createReactAgent } from "../index.js";

const tools = [new TavilySearchResults({ maxResults: 1 })];

test("createReactAgent works", async () => {
  const prompt = await pull<PromptTemplate>("hwchase17/react");
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo-instruct",
    temperature: 0,
  });
  const agent = await createReactAgent({
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

  // console.log(result);

  expect(result.input).toBe(input);
  expect(typeof result.output).toBe("string");
  // Length greater than 10 because any less than that would warrant
  // an investigation into why such a short generation was returned.
  expect(result.output.length).toBeGreaterThan(10);
});

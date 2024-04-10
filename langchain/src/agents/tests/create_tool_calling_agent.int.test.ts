import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AgentExecutor, createToolCallingAgent } from "../index.js";

const tools = [new TavilySearchResults({ maxResults: 1 })];

test("createToolCallingAgent works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
  const llm = new ChatOpenAI({
    modelName: "gpt-4-turbo",
    temperature: 0,
  });
  const agent = await createToolCallingAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  const input = "what is the current weather in SF?";
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

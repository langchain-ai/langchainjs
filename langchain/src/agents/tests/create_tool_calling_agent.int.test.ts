import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "../../util/testing/tools/tavily_search.js";
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

test("createToolCallingAgent stream events works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
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
  const eventStream = agentExecutor.streamEvents(
    {
      input,
    },
    {
      version: "v2",
    }
  );

  for await (const event of eventStream) {
    const eventType = event.event;
    console.log("Event type: ", eventType);
    if (eventType === "on_chat_model_stream") {
      console.log("Content: ", event.data);
    }
  }
});

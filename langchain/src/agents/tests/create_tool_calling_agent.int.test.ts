import { z } from "zod";
import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { TavilySearchResults } from "../../util/testing/tools/tavily_search.js";
import { AgentExecutor, createToolCallingAgent } from "../index.js";

const syntaxErrorTool = new DynamicStructuredTool({
  name: "query",
  description:
    "use this tool to generate and execute a query from a question using the index.",
  schema: z.object({
    index_name: z.string().describe("The name of the index to query."),
    question: z.string().describe("The question to answer."),
  }),
  func: async (_params) => {
    return JSON.stringify({
      result: "-ERR Syntax error at offset 19 near Bronx",
      query:
        'FT.AGGREGATE bites "@Borough:{The Bronx} @Gender:{M}" GROUPBY 0 REDUCE COUNT 0',
    });
  },
});

const tools = [new TavilySearchResults({ maxResults: 1 })];

test("createToolCallingAgent works", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
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

  // console.log(result);

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
    model: "gpt-4o-mini",
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
    // console.log("Event type: ", eventType);
    if (eventType === "on_chat_model_stream") {
      // console.log("Content: ", event.data);
    }
  }
});

test("createToolCallingAgent stream events works for multiple turns", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });
  const agent = await createToolCallingAgent({
    llm,
    tools: [syntaxErrorTool],
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools: [syntaxErrorTool],
    maxIterations: 3,
  });
  const input =
    "Generate a query that looks up how many animals have been bitten in the Bronx.";
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
    // console.log("Event type: ", eventType);
    if (eventType === "on_chat_model_stream") {
      // console.log("Content: ", event.data);
    }
  }
});

test("createToolCallingAgent accepts fallbacks", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  })
    .bindTools(tools)
    .withFallbacks({
      fallbacks: [
        new ChatOpenAI({
          model: "gpt-4o-mini",
          temperature: 0,
        }).bindTools(tools),
      ],
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
    // console.log("Event type: ", eventType);
    if (eventType === "on_chat_model_stream") {
      // console.log("Content: ", event.data);
    }
  }
});

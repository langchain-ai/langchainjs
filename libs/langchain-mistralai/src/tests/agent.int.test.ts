// import { test, expect } from "@jest/globals";
// import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
// import { Calculator } from "@langchain/community/tools/calculator";
// import { BaseChatModel } from "@langchain/core/language_models/chat_models";
// import { SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, ChatPromptTemplate } from "@langchain/core/prompts";
// import { DynamicStructuredTool } from "@langchain/core/tools";
// import { z } from "zod/v3";
// import { ChatMistralAI } from "../chat_models.js";
// import { AgentExecutor, createOpenAIToolsAgent, createToolCallingAgent } from "langchain/agents";

// const tool = new TavilySearchResults({ maxResults: 1 });
// tool.description = tool.description += " You can also use this tool to check the current weather.";
// const tools = [tool, new Calculator()];

// TODO: This test breaks CI build due to dependencies. Figure out a way around it.
test("createToolCallingAgent works", async () => {
  // const prompt = ChatPromptTemplate.fromMessages([
  //   ["system", "You are a helpful assistant. Use tools as often as possible"],
  //   ["placeholder", "{chat_history}"],
  //   ["human", "{input}"],
  //   ["placeholder", "{agent_scratchpad}"],
  // ]);
  // const llm = new ChatMistralAI({
  //   model: "mistral-large-latest",
  //   temperature: 0,
  // });
  // const agent = await createToolCallingAgent({
  //   llm,
  //   tools,
  //   prompt,
  // });
  // const agentExecutor = new AgentExecutor({
  //   agent,
  //   tools,
  // });
  // const input = "What is the current weather in SF?";
  // const result = await agentExecutor.invoke({
  //   input,
  // });
  // console.log(result);
  // expect(result.input).toBe(input);
  // expect(typeof result.output).toBe("string");
  // // Length greater than 10 because any less than that would warrant
  // // an investigation into why such a short generation was returned.
  // expect(result.output.length).toBeGreaterThan(10);
});

test("Model is compatible with OpenAI tools agent and Agent Executor", async () => {
  // const llm: BaseChatModel = new ChatMistralAI({
  //   temperature: 0,
  //   model: "mistral-large-latest",
  // });
  // const systemMessage = SystemMessagePromptTemplate.fromTemplate(
  //   "You are an agent capable of retrieving current weather information."
  // );
  // const humanMessage = HumanMessagePromptTemplate.fromTemplate("{input}");
  // const agentScratchpad = new MessagesPlaceholder("agent_scratchpad");
  // const prompt = ChatPromptTemplate.fromMessages([
  //   systemMessage,
  //   humanMessage,
  //   agentScratchpad,
  // ]);
  // const currentWeatherTool = new DynamicStructuredTool({
  //   name: "get_current_weather",
  //   description: "Get the current weather in a given location",
  //   schema: z.object({
  //     location: z
  //       .string()
  //       .describe("The city and state, e.g. San Francisco, CA"),
  //   }),
  //   func: async () => Promise.resolve("28 °C"),
  // });
  // const agent = await createOpenAIToolsAgent({
  //   llm,
  //   tools: [currentWeatherTool],
  //   prompt,
  // });
  // const agentExecutor = new AgentExecutor({
  //   agent,
  //   tools: [currentWeatherTool],
  // });
  // const input = "What's the weather like in Paris?";
  // const { output } = await agentExecutor.invoke({ input });
  // console.log(output);
  // expect(output).toBeDefined();
  // expect(output).toContain("The current temperature in Paris is 28 °C");
});

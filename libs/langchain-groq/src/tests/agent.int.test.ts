// import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
// import { ChatPromptTemplate } from "@langchain/core/prompts";
// import { DynamicStructuredTool } from "@langchain/core/tools";
// import { z } from "zod";
// import { ChatGroq } from "../chat_models.js";

// TODO: This test breaks CI build due to dependencies. Figure out a way around it.
test.skip("Model is compatible with OpenAI tools agent and Agent Executor", async () => {
  // const llm = new ChatGroq({
  //   temperature: 0,
  //   modelName: "mixtral-8x7b-32768",
  // });
  // const prompt = ChatPromptTemplate.fromMessages([
  //   [
  //     "system",
  //     "You are an agent capable of retrieving current weather information.",
  //   ],
  //   ["human", "{input}"],
  //   ["placeholder", "{agent_scratchpad}"],
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

// import { test, expect } from "@jest/globals";
// import { ChatPromptTemplate } from "@langchain/core/prompts";
// import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
// import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
// import { Calculator } from "@langchain/community/tools/calculator";
// import { ChatVertexAI } from "../index.js";

// const tools = [new TavilySearchResults({ maxResults: 1 }), new Calculator()];

// TODO: This test breaks CI build due to dependencies. Figure out a way around it.
test("createToolCallingAgent works", async () => {
  // const prompt = ChatPromptTemplate.fromMessages([
  //   ["system", "You are a helpful assistant"],
  //   ["placeholder", "{chat_history}"],
  //   ["human", "{input}"],
  //   ["placeholder", "{agent_scratchpad}"],
  // ]);
  // const llm = new ChatVertexAI({
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
  // const input = "what is the current weather in SF?";
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

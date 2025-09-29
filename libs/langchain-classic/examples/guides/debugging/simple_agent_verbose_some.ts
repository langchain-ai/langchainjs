import { createAgent } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearch } from "@langchain/tavily";
import { Calculator } from "@langchain/community/tools/calculator";

const tools = [
  new TavilySearch({ verbose: true }),
  new Calculator({ verbose: true }),
];

// Prompt template must have "input" and "agent_scratchpad input variables
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-20241022",
  temperature: 0,
  verbose: false,
});

const agent = await createAgent({
  llm,
  tools,
  prompt,
});

const result = await agent.invoke({
  messages:
    "Who directed the 2023 film Oppenheimer and what is their age? What is their age in days (assume 365 days per year)?",
});

console.log(result);

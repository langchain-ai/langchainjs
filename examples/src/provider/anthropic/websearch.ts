import { createAgent, HumanMessage } from "langchain";
import { ChatAnthropic, tools } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const agent = createAgent({
  model,
  tools: [
    tools.webSearch_20250305({
      maxUses: 5,
    }),
  ],
});

const result = await agent.invoke({
  messages: [new HumanMessage("What's the weather in NYC?")],
});

console.log(result);

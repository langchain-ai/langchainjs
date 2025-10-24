import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DiscordSendMessagesTool } from "@langchain/community/tools/discord";
import { DadJokeAPI } from "@langchain/community/tools/dadjokeapi";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const tools = [new DiscordSendMessagesTool(), new DadJokeAPI()];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  verbose: true,
});

const res = await executor.invoke({
  input: `Tell a joke in the discord channel`,
});

console.log(res.output);
// "What's the best thing about elevator jokes? They work on so many levels."

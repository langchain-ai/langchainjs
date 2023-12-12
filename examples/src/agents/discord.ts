import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DadJokeAPI } from "langchain/tools";
import { DiscordSendMessagesTool } from "@langchain/community/tools/discord";

const model = new ChatOpenAI({
  temperature: 0,
});

const tools = [new DiscordSendMessagesTool(), new DadJokeAPI()];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  verbose: true,
});

const res = await executor.call({
  input: `Tell a joke in the discord channel`,
});

console.log(res.output);
// "What's the best thing about elevator jokes? They work on so many levels."

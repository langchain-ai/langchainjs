import { test } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { initializeAgentExecutorWithOptions } from "../../agents/index.js";
import { DiscordSendMessagesTool } from "../../tools/discord.js";
import { DadJokeAPI } from "../../tools/dadjokeapi.js";

test("DiscordSendMessagesTool should tell a joke in the discord channel", async () => {
  const model = new ChatOpenAI({
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
});

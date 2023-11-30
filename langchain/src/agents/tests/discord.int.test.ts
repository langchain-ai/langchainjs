import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { initializeAgentExecutorWithOptions } from "../../agents/index.js";
import { DiscordSendMessagesTool } from "../../tools/discord.js";
import { DadJokeAPI } from "../../tools/dadjokeapi.js";

test.skip("DiscordSendMessagesTool should tell a joke in the discord channel", async () => {
  const model = new OpenAI({
    temperature: 0,
  });

  const tools = [
    new DiscordSendMessagesTool("1153400523718938780"),
    new DadJokeAPI(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const res = await executor.call({
    input: `Tell a joke in the discord channel`,
  });

  console.log(res.output);
});

import { ChatMinimax } from "../minimax.js";
import { HumanMessage } from "../../schema/index.js";

test("Test ChatOpenAI", async () => {
  const chat = new ChatMinimax({
    modelName: "abab5.5-chat",
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

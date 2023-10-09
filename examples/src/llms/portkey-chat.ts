import { PortkeyChat } from "langchain/chat_models/portkey";
import { SystemMessage } from "langchain/schema";

export const run = async () => {
  const model = new PortkeyChat({
    mode: "single",
    llms: [
      {
        provider: "openai",
        virtual_key: "open-ai-key-1234",
        model: "gpt-3.5-turbo",
        max_tokens: 2000,
      },
    ],
  });
  const chatPrompt = [new SystemMessage("Question: Write a story")];
  const res = await model.stream(chatPrompt);
  for await (const i of res) {
    process.stdout.write(i.content);
  }
};

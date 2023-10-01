import { PortkeyChat } from "langchain/chat_models/portkey";

export const run = async () => {
  const model = new PortkeyChat({
    mode: "single",
    llms: [
      {
        provider: "anyscale",
        api_key: "esecret_kj5euqeldwwc9sb1wz8cxxfa2t",
        model: "meta-llama/Llama-2-13b-chat-hf",
        max_tokens: 2000,
      },
    ],
  });
  const res = await model.stream(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  for await (const i of res) {
    process.stdout.write(i);
  }
};

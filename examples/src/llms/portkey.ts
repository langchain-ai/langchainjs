import { Portkey } from "langchain/llms/portkey";

export const run = async () => {
  const model = new Portkey({
    mode: "single",
    llms: [
      {
        provider: "openai",
        virtual_key: "open-ai-key-1234",
        model: "text-davinci-003",
        max_tokens: 2000,
      },
    ],
  });
  const res = await model.stream(
    "Question: Write a story about a king\nAnswer:"
  );
  for await (const i of res) {
    process.stdout.write(i);
  }
};

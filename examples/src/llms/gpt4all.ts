import { GPT4All } from "langchain/llms/gpt4all";

export const run = async () => {
  const model = new GPT4All({
    model: "gpt4all-lora-unfiltered-quantized",
    forceDownload: true, // Defaults to false
    decoderConfig: {}, // Defaults to {}
  });
  const res = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};

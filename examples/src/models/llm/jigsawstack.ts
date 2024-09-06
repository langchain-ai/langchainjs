import { JigsawStackPromptEngine } from "@langchain/jigsawstack";

export const run = async () => {
  const model = new JigsawStackPromptEngine();
  const res = await model.invoke(
    "Tell me about the leaning tower of pisa?\nAnswer:"
  );
  console.log({ res });
};

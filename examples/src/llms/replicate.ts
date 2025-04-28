import { Replicate } from "@langchain/community/llms/replicate";

export const run = async () => {
  const model = new Replicate({
    model:
      "replicate/flan-t5-xl:3ae0799123a1fe11f8c89fd99632f843fc5f7a761630160521c4253149754523",
  });
  const res = await model.invoke(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  console.log({ res });
};

import { Replicate } from "langchain/llms";

export const run = async () => {
  const model = new Replicate({
    model = "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
  });
  const res = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log("hello", { res });
};

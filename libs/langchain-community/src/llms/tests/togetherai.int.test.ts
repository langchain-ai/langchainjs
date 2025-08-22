import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TogetherAI } from "../togetherai.js";

test.skip("TogetherAI can make a request to an LLM", async () => {
  const model = new TogetherAI({
    model: "togethercomputer/StripedHyena-Nous-7B",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant."],
    ["human", "Tell me a joke about bears."],
  ]);
  const chain = prompt.pipe(model);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await chain.invoke({});
  // console.log("result", result);
});

test.skip("TogetherAI can stream responses", async () => {
  const model = new TogetherAI({
    model: "togethercomputer/StripedHyena-Nous-7B",
    streaming: true,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant."],
    ["human", "Tell me a joke about bears."],
  ]);
  const chain = prompt.pipe(model);
  const result = await chain.stream({});
  let numItems = 0;
  let fullText = "";
  for await (const item of result) {
    // console.log("stream item", item);
    fullText += item;
    numItems += 1;
  }
  // console.log(fullText);
  expect(numItems).toBeGreaterThan(1);
});

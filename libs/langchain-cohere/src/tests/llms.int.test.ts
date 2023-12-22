import { test } from "@jest/globals";
import { PromptTemplate } from "@langchain/core/prompts";
import { BytesOutputParser } from "@langchain/core/output_parsers";
import { Cohere } from "../llm.js";

test.skip("test call", async () => {
  const cohere = new Cohere({});
  const result = await cohere.invoke(
    "What is a good name for a company that makes colorful socks?"
  );
  console.log({ result });
});

test.skip("test call with callback", async () => {
  const cohere = new Cohere({
    model: "command-light"
  });
  const tokens: string[] = [];
  const result = await cohere.invoke(
    "What is a good name for a company that makes colorful socks?",
    {
      callbacks: [
        {
          handleLLMNewToken(token) {
            tokens.push(token);
          }
        }
      ]
    }
  );
  // Not streaming, so we should only get one token
  expect(tokens.length).toBe(1);
  expect(result).toEqual(tokens.join(""));
});

test("should abort the request", async () => {
  const cohere = new Cohere({
    model: "command-light"
  });
  const controller = new AbortController();

  await expect(() => {
    const ret = cohere.invoke("Respond with an extremely verbose response", {
      signal: controller.signal
    });
    controller.abort();
    return ret;
  }).rejects.toThrow("This operation was aborted");
});

test("should stream through with a bytes output parser", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

  User: {input}
  AI:`;

  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const cohere = new Cohere({
    model: "command-light"
  });
  const outputParser = new BytesOutputParser();
  const chain = prompt.pipe(cohere).pipe(outputParser);
  const stream = await chain.stream({
    input: `Translate "I love programming" into German.`
  });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

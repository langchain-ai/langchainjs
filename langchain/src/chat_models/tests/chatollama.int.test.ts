import { test } from "@jest/globals";
import { ChatOllama } from "../ollama.js";
import { AIMessage, HumanMessage } from "../../schema/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { BytesOutputParser } from "../../schema/output_parser.js";

test.skip("test call", async () => {
  const ollama = new ChatOllama({});
  const result = await ollama.predict(
    "What is a good name for a company that makes colorful socks?"
  );
  console.log({ result });
});

test.skip("test call with callback", async () => {
  const ollama = new ChatOllama({
    baseUrl: "http://localhost:11434",
  });
  const tokens: string[] = [];
  const result = await ollama.predict(
    "What is a good name for a company that makes colorful socks?",
    {
      callbacks: [
        {
          handleLLMNewToken(token) {
            tokens.push(token);
          },
        },
      ],
    }
  );
  expect(tokens.length).toBeGreaterThan(1);
  expect(result).toEqual(tokens.join(""));
});

test.skip("test streaming call", async () => {
  const ollama = new ChatOllama({
    baseUrl: "http://localhost:11434",
  });
  const stream = await ollama.stream(
    `Translate "I love programming" into German.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test.skip("should abort the request", async () => {
  const ollama = new ChatOllama({
    baseUrl: "http://localhost:11434",
  });
  const controller = new AbortController();

  await expect(() => {
    const ret = ollama.predict("Respond with an extremely verbose response", {
      signal: controller.signal,
    });
    controller.abort();
    return ret;
  }).rejects.toThrow("This operation was aborted");
});

test.skip("Test multiple messages", async () => {
  const model = new ChatOllama({ baseUrl: "http://localhost:11434" });
  const res = await model.call([
    new HumanMessage({ content: "My name is Jonas" }),
  ]);
  console.log({ res });
  const res2 = await model.call([
    new HumanMessage("My name is Jonas"),
    new AIMessage(
      "Hello Jonas! It's nice to meet you. Is there anything I can help you with?"
    ),
    new HumanMessage("What did I say my name was?"),
  ]);
  console.log({ res2 });
});

test.skip("Test chain with memory", async () => {
  const template = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{history}
Human: {input}`;
  const model = new ChatOllama({ baseUrl: "http://localhost:11434" });
  const chain = new LLMChain({
    prompt: PromptTemplate.fromTemplate(template),
    llm: model,
    memory: new BufferMemory({}),
  });
  const res = await chain.call({ input: "My name is Jonas" });
  console.log({ res });
  const res2 = await chain.call({
    input: "What did I say my name was?",
  });
  console.log({ res2 });
  const res3 = await chain.call({
    input: "What is your name?",
  });
  console.log({ res3 });
});

test.skip("should stream through with a bytes output parser", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

  User: {input}
  AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new ChatOllama({
    model: "llama2",
    baseUrl: "http://127.0.0.1:11434",
  });
  const outputParser = new BytesOutputParser();
  const chain = prompt.pipe(ollama).pipe(outputParser);
  const stream = await chain.stream({
    input: `Translate "I love programming" into German.`,
  });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

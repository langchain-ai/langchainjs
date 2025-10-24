import { test } from "@jest/globals";
import { OpenAI, ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
} from "@langchain/core/prompts";
import { LLMChain } from "../llm_chain.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({ foo: "my favorite color" });
  // console.log({ res });
});

test("Test OpenAI with timeout", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  await expect(() =>
    chain.call({
      foo: "my favorite color",
      timeout: 10,
    })
  ).rejects.toThrow();
});

test("Test run method", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.run("my favorite color");
  // console.log({ res });
});

test("Test run method", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.run("my favorite color");
  // console.log({ res });
});

test("Test memory + cancellation", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  await expect(() =>
    chain.call({
      foo: "my favorite color",
      signal: AbortSignal.timeout(20),
    })
  ).rejects.toThrow();
});

test("Test memory + timeout", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  await expect(() =>
    chain.call({
      foo: "my favorite color",
      timeout: 20,
    })
  ).rejects.toThrow();
});

test("Test apply", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.apply([{ foo: "my favorite color" }]);
  // console.log({ res });
});

test("Test LLMChain with ChatOpenAI", async () => {
  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.9 });
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const humanMessagePrompt = new HumanMessagePromptTemplate(prompt);
  const chatPromptTemplate = ChatPromptTemplate.fromMessages([
    humanMessagePrompt,
  ]);
  const chatChain = new LLMChain({ llm: model, prompt: chatPromptTemplate });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chatChain.call({ product: "colorful socks" });
  // console.log({ res });
});

test("Test passing a runnable to an LLMChain", async () => {
  const model = new ChatOpenAI({ model: "gpt-3.5-turbo-1106" });
  const runnableModel = model.withConfig({
    response_format: {
      type: "json_object",
    },
  });
  const prompt = PromptTemplate.fromTemplate(
    "You are a bee --I mean a spelling bee. Respond with a JSON key of 'spelling':\nQuestion:{input}"
  );
  const chain = new LLMChain({ llm: runnableModel, prompt });
  const response = await chain.invoke({ input: "How do you spell today?" });
  expect(JSON.parse(response.text)).toMatchObject({
    spelling: expect.any(String),
  });
});

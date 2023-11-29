import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
} from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });
  console.log({ res });
});

test("Test OpenAI with timeout", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
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
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.run("my favorite color");
  console.log({ res });
});

test("Test run method", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  const res = await chain.run("my favorite color");
  console.log({ res });
});

test("Test memory + cancellation", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
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
  const model = new OpenAI({ modelName: "text-ada-001" });
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
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.apply([{ foo: "my favorite color" }]);
  console.log({ res });
});

test("Test LLMChain with ChatOpenAI", async () => {
  const model = new ChatOpenAI({ temperature: 0.9 });
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const humanMessagePrompt = new HumanMessagePromptTemplate(prompt);
  const chatPromptTemplate = ChatPromptTemplate.fromMessages([
    humanMessagePrompt,
  ]);
  const chatChain = new LLMChain({ llm: model, prompt: chatPromptTemplate });
  const res = await chatChain.call({ product: "colorful socks" });
  console.log({ res });
});

test("Test passing a runnable to an LLMChain", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo-1106" });
  const runnableModel = model.bind({
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

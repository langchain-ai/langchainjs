import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/index.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
} from "../../prompts/index.js";
import { LLMChain, ConversationChain } from "../llm_chain.js";
import { loadChain } from "../load.js";

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

test("Load chain from hub", async () => {
  const chain = await loadChain("lc://chains/hello-world/chain.json");
  const res = await chain.call({ topic: "my favorite color" });
  console.log({ res });
});

test("Test ConversationChain", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = new ConversationChain({ llm: model });
  const res = await chain.call({ input: "my favorite color" });
  console.log({ res });
});

test("Test LLMChain with ChatOpenAI", async () => {
  const model = new ChatOpenAI({ temperature: 0.9 });
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const humanMessagePrompt = new HumanMessagePromptTemplate(prompt);
  const chatPromptTemplate = ChatPromptTemplate.fromPromptMessages([
    humanMessagePrompt,
  ]);
  const chatChain = new LLMChain({ llm: model, prompt: chatPromptTemplate });
  const res = await chatChain.call({ product: "colorful socks" });
  console.log({ res });
});

test("Test deserialize", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });

  const serialized = chain.serialize();
  console.log(serialized);
  const chain2 = await LLMChain.deserialize({ ...serialized });

  const res = await chain2.run("my favorite color");
  console.log({ res });
});

// {
//   _type: 'llm_chain',
//   prompt: {
//     _type: 'prompt',
//     input_variables: [ 'foo' ],
//     output_parser: undefined,
//     template: 'Print {foo}',
//     template_format: 'f-string'
//   }
// }

// {
//   "memory": null,
//   "verbose": false,
//   "prompt": {
//       "input_variables": [
//           "topic"
//       ],
//       "output_parser": null,
//       "template": "Tell me a joke about {topic}:",
//       "template_format": "f-string",
//       "_type": "prompt"
//   },
//   "llm": {
//       "model_name": "text-davinci-003",
//       "temperature": 0.9,
//       "max_tokens": 256,
//       "top_p": 1,
//       "frequency_penalty": 0,
//       "presence_penalty": 0,
//       "n": 1,
//       "best_of": 1,
//       "request_timeout": null,
//       "logit_bias": {},
//       "_type": "openai"
//   },
//   "output_key": "text",
//   "_type": "llm_chain"
// }

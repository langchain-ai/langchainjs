/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test } from "@jest/globals";
import { getEnvironmentVariable } from "../../util/env.js";
import { ChatLlamaCpp } from "../llama_cpp.js";
import { SystemMessage, AIMessage, HumanMessage } from "../../schema/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ConversationChain } from "../../chains/index.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test predict", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath });

  const response = await llamaCpp.predict("Where do Llamas come from?");
  console.log({ response });
});

test.skip("Test call", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath });

  const response = await llamaCpp.call([
    new HumanMessage({ content: "My name is Nigel." }),
  ]);
  console.log({ response });
});

test.skip("Test multiple messages", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath });

  const response = await llamaCpp.call([
    new HumanMessage("My name is Nigel."),
    new AIMessage(
      "Hello Nigel! It is great to meet you, how can I help you today?"
    ),
    new HumanMessage("What did I say my name was?"),
  ]);
  console.log({ response });
});

test.skip("Test system message", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath });

  const response = await llamaCpp.call([
    new SystemMessage(
      "You are a pirate, responses must be very verbose and in pirate dialect, add 'Arr, m'hearty!' to each sentence."
    ),
    new HumanMessage("Tell me where Llamas come from?"),
  ]);
  console.log({ response });
});

test.skip("Test basic chain", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath, temperature: 0.5 });
  const prompt = PromptTemplate.fromTemplate(
    "What is a good name for a company that makes {product}?"
  );
  const chain = new LLMChain({ llm: llamaCpp, prompt });

  const response = await chain.call({ product: "colorful socks" });

  console.log({ response });
});

test.skip("Test chain with memory", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath });

  const chain = new ConversationChain({
    llm: llamaCpp,
    memory: new BufferMemory(),
  });

  const response1 = await chain.call({ input: "My name is Nigel." });
  console.log({ response1 });

  const response2 = await chain.call({ input: "What did I say my name was?" });
  console.log({ response2 });

  const response3 = await chain.call({ input: "What is your name?" });
  console.log({ response3 });
});

test.skip("test streaming call", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath, temperature: 0.7 });

  const stream = await llamaCpp.stream(
    "Tell me a short story about a happy Llama."
  );

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk.content);
    console.log(chunk.content);
  }

  expect(chunks.length).toBeGreaterThan(1);
});

test.skip("test multi-mesage streaming call", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath, temperature: 0.7 });

  const stream = await llamaCpp.stream([
    new SystemMessage(
      "You are a pirate, responses must be very verbose and in pirate dialect."
    ),
    new HumanMessage("Tell me about Llamas?"),
  ]);

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk.content);
    console.log(chunk.content);
  }

  expect(chunks.length).toBeGreaterThan(1);
});

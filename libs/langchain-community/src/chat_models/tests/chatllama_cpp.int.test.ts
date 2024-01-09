/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  SystemMessage,
  AIMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { ChatLlamaCpp } from "../llama_cpp.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test predict", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath });

  const response = await llamaCpp.invoke("Where do Llamas come from?");
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

import { test } from "@jest/globals";
import { getEnvironmentVariable } from "../../util/env.js";
import { ChatLlamaCpp } from "../llama_cpp.js";
import { SystemMessage, AIMessage, HumanMessage } from "../../schema/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

const LLAMA_PATH = getEnvironmentVariable("LLAMA_PATH")!;


test.skip("test call", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: LLAMA_PATH });

  const response = await llamaCpp.predict("Where do Llamas come from?");
  console.log({ response });
});


test.skip("Test messages", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: LLAMA_PATH });

  const response1 = await llamaCpp.call([
    new HumanMessage({ content: "My name is Nigel." }),
  ]);
  console.log({ response1 });

  const response2 = await llamaCpp.call([
    new HumanMessage("My name is Nigel."),
    new AIMessage(
      "Hello Nigel! It is great to meet you, how can I help you today?"
    ),
    new HumanMessage("What did I say my name was?"),
  ]);
  console.log({ response2 });
});


test("Test chain with memory", async () => {
  const template = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{history}
Human: {input}`;

  const llamaCpp = new ChatLlamaCpp({ modelPath: LLAMA_PATH });
  const chain = new LLMChain({
    prompt: PromptTemplate.fromTemplate(template),
    llm: llamaCpp,
    memory: new BufferMemory({}),
  });

  const response1 = await chain.call({ input: "My name is Nigel." });
  console.log({ response1 });

  const response2 = await chain.call({ input: "What did I say my name was?" });
  console.log({ response2 });

  const response3 = await chain.call({ input: "What is your name?" });
  console.log({ response3 });
});


test.skip("system message test", async () => {
  const llamaCpp = new ChatLlamaCpp({ modelPath: LLAMA_PATH });

  const response = await llamaCpp.call([
    new SystemMessage(
      "You are a pirate, responses must be very verbose and in pirate dialect, add 'Arr, m'hearty!' to each sentence."
    ),
    new HumanMessage("Tell me where Llamas come from?"),
  ]);
  console.log({ response });
});

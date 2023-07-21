import { OpenAI } from "langchain/llms/openai";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";

export const run = async () => {
  // summary buffer memory
  let memory = new ConversationSummaryBufferMemory({
    llm: new OpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
    max_token_limit: 10,
  });

  await memory.saveContext({ input: "hi" }, { output: "whats up" });
  await memory.saveContext({ input: "not much you" }, { output: "not much" });
  const history = await memory.loadMemoryVariables({});
  console.log({ history });

  // We can also get the history as a list of messages (this is useful if you are using this with a chat model).
  memory = new ConversationSummaryBufferMemory({
    llm: new OpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
    max_token_limit: 10,
    returnMessages: true,
  });
  await memory.saveContext({ input: "hi" }, { output: "whats up" });
  await memory.saveContext({ input: "not much you" }, { output: "not much" });

  // We can also utilize the predict_new_summary method directly.
  const messages = await memory.chatHistory.getMessages();
  const previous_summary = "";
  const predictSummary = await memory.predictNewSummary(
    messages,
    previous_summary
  );
  console.log(JSON.stringify(predictSummary));

  // Using in a chain
  // Let's walk through an example, again setting verbose=True so we can see the prompt.

  const model = new OpenAI({ temperature: 0.9, verbose: true });
  const chain = new ConversationChain({ llm: model, memory });

  const res1 = await chain.predict({ input: "Hi, what's up?" });
  console.log({ res1 });

  const res2 = await chain.predict({
    input: "Just working on writing some documentation!",
  });
  console.log({ res2 });

  const res3 = await chain.predict({
    input: "For LangChain! Have you heard of it?",
  });
  console.log({ res3 });

  const res4 = await chain.predict({
    input: "Haha nope, although a lot of people confuse it for that",
  });
  console.log({ res4 });
};

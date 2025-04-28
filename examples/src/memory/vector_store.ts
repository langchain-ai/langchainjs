import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { VectorStoreRetrieverMemory } from "langchain/memory";
import { LLMChain } from "langchain/chains";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PromptTemplate } from "@langchain/core/prompts";

const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
const memory = new VectorStoreRetrieverMemory({
  // 1 is how many documents to return, you might want to return more, eg. 4
  vectorStoreRetriever: vectorStore.asRetriever(1),
  memoryKey: "history",
});

// First let's save some information to memory, as it would happen when
// used inside a chain.
await memory.saveContext(
  { input: "My favorite food is pizza" },
  { output: "thats good to know" }
);
await memory.saveContext(
  { input: "My favorite sport is soccer" },
  { output: "..." }
);
await memory.saveContext({ input: "I don't the Celtics" }, { output: "ok" });

// Now let's use the memory to retrieve the information we saved.
console.log(
  await memory.loadMemoryVariables({ prompt: "what sport should i watch?" })
);
/*
{ history: 'input: My favorite sport is soccer\noutput: ...' }
*/

// Now let's use it in a chain.
const model = new OpenAI({ temperature: 0.9 });
const prompt =
  PromptTemplate.fromTemplate(`The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Relevant pieces of previous conversation:
{history}

(You do not need to use these pieces of information if not relevant)

Current conversation:
Human: {input}
AI:`);
const chain = new LLMChain({ llm: model, prompt, memory });

const res1 = await chain.invoke({ input: "Hi, my name is Perry, what's up?" });
console.log({ res1 });
/*
{
  res1: {
    text: " Hi Perry, I'm doing great! I'm currently exploring different topics related to artificial intelligence like natural language processing and machine learning. What about you? What have you been up to lately?"
  }
}
*/

const res2 = await chain.invoke({ input: "what's my favorite sport?" });
console.log({ res2 });
/*
{ res2: { text: ' You said your favorite sport is soccer.' } }
*/

const res3 = await chain.invoke({ input: "what's my name?" });
console.log({ res3 });
/*
{ res3: { text: ' Your name is Perry.' } }
*/

// Sometimes we might want to save metadata along with the conversation snippets
const memoryWithMetadata = new VectorStoreRetrieverMemory({
  vectorStoreRetriever: vectorStore.asRetriever(
    1,
    (doc) => doc.metadata?.userId === "1"
  ),
  memoryKey: "history",
  metadata: { userId: "1", groupId: "42" },
});

await memoryWithMetadata.saveContext(
  { input: "Community is my favorite TV Show" },
  { output: "6 seasons and a movie!" }
);

console.log(
  await memoryWithMetadata.loadMemoryVariables({
    prompt: "what show should i watch? ",
  })
);
/*
{ history: 'input: Community is my favorite TV Show\noutput: 6 seasons and a movie!' }
*/

// If we have a retriever whose filter does not match our metadata, our previous messages won't appear
const memoryWithoutMatchingMetadata = new VectorStoreRetrieverMemory({
  vectorStoreRetriever: vectorStore.asRetriever(
    1,
    (doc) => doc.metadata?.userId === "2"
  ),
  memoryKey: "history",
});

// There are no messages saved for userId 2
console.log(
  await memoryWithoutMatchingMetadata.loadMemoryVariables({
    prompt: "what show should i watch? ",
  })
);
/*
{ history: '' }
*/

// If we need the metadata to be dynamic, we can pass a function instead
const memoryWithMetadataFunction = new VectorStoreRetrieverMemory({
  vectorStoreRetriever: vectorStore.asRetriever(1),
  memoryKey: "history",
  metadata: (inputValues, _outputValues) => ({
    firstWord: inputValues?.input.split(" ")[0], // First word of the input
    createdAt: new Date().toLocaleDateString(), // Date when the message was saved
    userId: "1", // Hardcoded userId
  }),
});

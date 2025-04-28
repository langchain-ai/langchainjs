import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { BufferMemory } from "langchain/memory";

const CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT = `Given the following conversation and a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
Chat History:
{chat_history}
Follow Up Input: {question}
Your answer should follow the following format:
\`\`\`
Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
<Relevant chat history excerpt as context here>
Standalone question: <Rephrased question here>
\`\`\`
Your answer:`;

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const vectorStore = await HNSWLib.fromTexts(
  [
    "Mitochondria are the powerhouse of the cell",
    "Foo is red",
    "Bar is red",
    "Buildings are made out of brick",
    "Mitochondria are made of lipids",
  ],
  [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
  new OpenAIEmbeddings()
);

const chain = ConversationalRetrievalQAChain.fromLLM(
  model,
  vectorStore.asRetriever(),
  {
    memory: new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
    }),
    questionGeneratorChainOptions: {
      template: CUSTOM_QUESTION_GENERATOR_CHAIN_PROMPT,
    },
  }
);

const res = await chain.invoke({
  question:
    "I have a friend called Bob. He's 28 years old. He'd like to know what the powerhouse of the cell is?",
});

console.log(res);
/*
  {
    text: "The powerhouse of the cell is the mitochondria."
  }
*/

const res2 = await chain.invoke({
  question: "How old is Bob?",
});

console.log(res2); // Bob is 28 years old.

/*
  {
    text: "Bob is 28 years old."
  }
*/

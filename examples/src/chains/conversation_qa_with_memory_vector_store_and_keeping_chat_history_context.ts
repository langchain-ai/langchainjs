import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { BufferMemory } from "langchain/memory";

export const run = async () => {
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
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
        extractConversationContext: true, // Remember that you cannot provide `template` alongside `extractConversationContext`, since it will throw a prompt template conflict error
      },
    }
  );

  const res = await chain.call({
    question:
      "I have a friend called Bob. He's 28 years old. He'd like to know what is the powerhouse of the cell?",
  });

  console.log(res); // AI answers: The powerhouse of the cell is the mitochondria.

  const res2 = await chain.call({
    question: "How old is Bob?",
  });

  console.log(res2); // AI answers: Bob is 28 years old.
};

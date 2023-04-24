import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain } from "langchain/chains";
import { RemoteLangChainRetriever } from "langchain/retrievers/remote";

export const run = async () => {
  // Initialize the LLM to use to answer the question.
  const model = new OpenAI({});

  // Initialize the remote retriever.
  const retriever = new RemoteLangChainRetriever({
    url: "http://0.0.0.0:8080/retrieve", // Replace with your own URL.
    auth: { bearer: "foo" }, // Replace with your own auth.
    inputKey: "message",
    responseKey: "response",
  });

  // Create a chain that uses the OpenAI LLM and remote retriever.
  const chain = RetrievalQAChain.fromLLM(model, retriever);

  // Call the chain with a query.
  const res = await chain.call({
    query: "What did the president say about Justice Breyer?",
  });
  console.log({ res });
  /*
  {
    res: {
      text: 'The president said that Justice Breyer was an Army veteran, Constitutional scholar,
      and retiring Justice of the United States Supreme Court and thanked him for his service.'
    }
  }
  */
};

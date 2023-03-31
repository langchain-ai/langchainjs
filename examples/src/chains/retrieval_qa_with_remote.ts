import { OpenAI } from "langchain/llms";
import { RetrievalQAChain } from "langchain/chains";
import { RemoteLangChainRetriever } from "langchain/retrievers";

export const run = async () => {
  // Initialize the LLM to use to answer the question.
  const model = new OpenAI({});
  const retriever = new RemoteLangChainRetriever({
    url: "http://0.0.0.0:8080/retrieve",
    auth: { Authorization: "Bearer foo" },
    input_key: "message",
    response_key: "response",
  });

  // Create a chain that uses the OpenAI LLM and HNSWLib vector store.
  const chain = RetrievalQAChain.fromLLM(model, retriever);
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

import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import {
  createRetrieverTool,
  createConversationalRetrievalAgent,
} from "langchain/agents/toolkits";
import { ChatOpenAI } from "langchain/chat_models/openai";

const loader = new TextLoader("state_of_the_union.txt");
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 0,
});

const texts = await splitter.splitDocuments(docs);

const vectorStore = await FaissStore.fromDocuments(
  texts,
  new OpenAIEmbeddings()
);

const retriever = vectorStore.asRetriever();

const tool = createRetrieverTool(retriever, {
  name: "search_state_of_union",
  description:
    "Searches and returns documents regarding the state-of-the-union.",
});

const model = new ChatOpenAI({});

const executor = await createConversationalRetrievalAgent(model, [tool], {
  verbose: true,
});

const result = await executor.invoke({
  input: "Hi, I'm Bob!",
});

console.log(result);

/*
  {
    output: 'Hello Bob! How can I assist you today?',
    intermediateSteps: []
  }
*/

const result2 = await executor.invoke({
  input: "What's my name?",
});

console.log(result2);

/*
  { output: 'Your name is Bob.', intermediateSteps: [] }
*/

const result3 = await executor.invoke({
  input:
    "What did the president say about Ketanji Brown Jackson in the most recent state of the union?",
});

console.log(result3);

/*
  {
    output: "In the most recent state of the union, President Biden mentioned Ketanji Brown Jackson. He nominated her as a Circuit Court of Appeals judge and described her as one of the nation's top legal minds who will continue Justice Breyer's legacy of excellence. He mentioned that she has received a broad range of support, including from the Fraternal Order of Police and former judges appointed by Democrats and Republicans.",
    intermediateSteps: [
      {...}
    ]
  }
*/

const result4 = await executor.invoke({
  input: "How long ago did he nominate her?",
});

console.log(result4);

/*
  {
    output: 'President Biden nominated Ketanji Brown Jackson four days before the most recent state of the union address.',
    intermediateSteps: []
  }
*/

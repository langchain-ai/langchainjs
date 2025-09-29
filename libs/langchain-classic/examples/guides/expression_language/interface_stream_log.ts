import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { formatDocumentsAsString } from "langchain/util/document";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";

// Initialize the LLM to use to answer the question.
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const vectorStore = await HNSWLib.fromTexts(
  [
    "mitochondria is the powerhouse of the cell",
    "mitochondria is made of lipids",
  ],
  [{ id: 1 }, { id: 2 }],
  new OpenAIEmbeddings()
);

// Initialize a retriever wrapper around the vector store
const vectorStoreRetriever = vectorStore.asRetriever();

// Create a system & human prompt for the chat model
const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;
const messages = [
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
  HumanMessagePromptTemplate.fromTemplate("{question}"),
];
const prompt = ChatPromptTemplate.fromMessages(messages);

const chain = RunnableSequence.from([
  {
    context: vectorStoreRetriever.pipe(formatDocumentsAsString),
    question: new RunnablePassthrough(),
  },
  prompt,
  model,
  new StringOutputParser(),
]);

const logStream = await chain.streamLog("What is the powerhouse of the cell?");

let state;

for await (const logPatch of logStream) {
  console.log(JSON.stringify(logPatch));
  if (!state) {
    state = logPatch;
  } else {
    state = state.concat(logPatch);
  }
}

console.log("aggregate", state);

/*
  {"ops":[{"op":"replace","path":"","value":{"id":"5a79d2e7-171a-4034-9faa-63af88e5a451","streamed_output":[],"logs":{}}}]}

  {"ops":[{"op":"add","path":"/logs/RunnableMap","value":{"id":"5948dd9f-b827-45f8-9fa6-74e5cc972a56","name":"RunnableMap","type":"chain","tags":["seq:step:1"],"metadata":{},"start_time":"2023-12-23T00:20:46.664Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/RunnableSequence","value":{"id":"e9e9ef5e-3a04-4110-9a24-517c929b9137","name":"RunnableSequence","type":"chain","tags":["context"],"metadata":{},"start_time":"2023-12-23T00:20:46.804Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/RunnablePassthrough","value":{"id":"4c79d835-87e5-4ff8-b560-987aea83c0e4","name":"RunnablePassthrough","type":"chain","tags":["question"],"metadata":{},"start_time":"2023-12-23T00:20:46.805Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/RunnablePassthrough/final_output","value":{"output":"What is the powerhouse of the cell?"}},{"op":"add","path":"/logs/RunnablePassthrough/end_time","value":"2023-12-23T00:20:46.947Z"}]}

  {"ops":[{"op":"add","path":"/logs/VectorStoreRetriever","value":{"id":"1e169f18-711e-47a3-910e-ee031f70b6e0","name":"VectorStoreRetriever","type":"retriever","tags":["seq:step:1","hnswlib"],"metadata":{},"start_time":"2023-12-23T00:20:47.082Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/VectorStoreRetriever/final_output","value":{"documents":[{"pageContent":"mitochondria is the powerhouse of the cell","metadata":{"id":1}},{"pageContent":"mitochondria is made of lipids","metadata":{"id":2}}]}},{"op":"add","path":"/logs/VectorStoreRetriever/end_time","value":"2023-12-23T00:20:47.398Z"}]}

  {"ops":[{"op":"add","path":"/logs/RunnableLambda","value":{"id":"a0d61a88-8282-42be-8949-fb0e8f8f67cd","name":"RunnableLambda","type":"chain","tags":["seq:step:2"],"metadata":{},"start_time":"2023-12-23T00:20:47.495Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/RunnableLambda/final_output","value":{"output":"mitochondria is the powerhouse of the cell\n\nmitochondria is made of lipids"}},{"op":"add","path":"/logs/RunnableLambda/end_time","value":"2023-12-23T00:20:47.604Z"}]}

  {"ops":[{"op":"add","path":"/logs/RunnableSequence/final_output","value":{"output":"mitochondria is the powerhouse of the cell\n\nmitochondria is made of lipids"}},{"op":"add","path":"/logs/RunnableSequence/end_time","value":"2023-12-23T00:20:47.690Z"}]}

  {"ops":[{"op":"add","path":"/logs/RunnableMap/final_output","value":{"question":"What is the powerhouse of the cell?","context":"mitochondria is the powerhouse of the cell\n\nmitochondria is made of lipids"}},{"op":"add","path":"/logs/RunnableMap/end_time","value":"2023-12-23T00:20:47.780Z"}]}

  {"ops":[{"op":"add","path":"/logs/ChatPromptTemplate","value":{"id":"5b6cff77-0c52-4218-9bde-d92c33ad12f3","name":"ChatPromptTemplate","type":"prompt","tags":["seq:step:2"],"metadata":{},"start_time":"2023-12-23T00:20:47.864Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/ChatPromptTemplate/final_output","value":{"lc":1,"type":"constructor","id":["langchain_core","prompt_values","ChatPromptValue"],"kwargs":{"messages":[{"lc":1,"type":"constructor","id":["langchain_core","messages","SystemMessage"],"kwargs":{"content":"Use the following pieces of context to answer the question at the end.\nIf you don't know the answer, just say that you don't know, don't try to make up an answer.\n----------------\nmitochondria is the powerhouse of the cell\n\nmitochondria is made of lipids","additional_kwargs":{}}},{"lc":1,"type":"constructor","id":["langchain_core","messages","HumanMessage"],"kwargs":{"content":"What is the powerhouse of the cell?","additional_kwargs":{}}}]}}},{"op":"add","path":"/logs/ChatPromptTemplate/end_time","value":"2023-12-23T00:20:47.956Z"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI","value":{"id":"0cc3b220-ca7f-4fd3-88d5-bea1f7417c3d","name":"ChatOpenAI","type":"llm","tags":["seq:step:3"],"metadata":{},"start_time":"2023-12-23T00:20:48.126Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/StrOutputParser","value":{"id":"47d9bd52-c14a-420d-8d52-1106d751581c","name":"StrOutputParser","type":"parser","tags":["seq:step:4"],"metadata":{},"start_time":"2023-12-23T00:20:48.666Z","streamed_output_str":[]}}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":""}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":""}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":"The"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":"The"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" mitochond"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" mitochond"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":"ria"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":"ria"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" is"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" is"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" the"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" the"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" powerhouse"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" powerhouse"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" of"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" of"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" the"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" the"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":" cell"}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":" cell"}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":"."}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":"."}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/streamed_output_str/-","value":""}]}

  {"ops":[{"op":"add","path":"/streamed_output/-","value":""}]}

  {"ops":[{"op":"add","path":"/logs/ChatOpenAI/final_output","value":{"generations":[[{"text":"The mitochondria is the powerhouse of the cell.","generationInfo":{"prompt":0,"completion":0},"message":{"lc":1,"type":"constructor","id":["langchain_core","messages","AIMessageChunk"],"kwargs":{"content":"The mitochondria is the powerhouse of the cell.","additional_kwargs":{}}}}]]}},{"op":"add","path":"/logs/ChatOpenAI/end_time","value":"2023-12-23T00:20:48.841Z"}]}

  {"ops":[{"op":"add","path":"/logs/StrOutputParser/final_output","value":{"output":"The mitochondria is the powerhouse of the cell."}},{"op":"add","path":"/logs/StrOutputParser/end_time","value":"2023-12-23T00:20:48.945Z"}]}

  {"ops":[{"op":"replace","path":"/final_output","value":{"output":"The mitochondria is the powerhouse of the cell."}}]}
*/

// Aggregate
/**
aggregate {
  id: '1ed678b9-e1cf-4ef9-bb8b-2fa083b81725',
  streamed_output: [
    '',            'The',
    ' powerhouse', ' of',
    ' the',        ' cell',
    ' is',         ' the',
    ' mitochond',  'ria',
    '.',           ''
  ],
  final_output: { output: 'The powerhouse of the cell is the mitochondria.' },
  logs: {
    RunnableMap: {
      id: 'ff268fa1-a621-41b5-a832-4f23eae99d8e',
      name: 'RunnableMap',
      type: 'chain',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:33.851Z',
      streamed_output_str: [],
      final_output: [Object],
      end_time: '2024-01-04T20:21:35.000Z'
    },
    RunnablePassthrough: {
      id: '62b54982-edb3-4101-a53e-1d4201230668',
      name: 'RunnablePassthrough',
      type: 'chain',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:34.073Z',
      streamed_output_str: [],
      final_output: [Object],
      end_time: '2024-01-04T20:21:34.226Z'
    },
    RunnableSequence: {
      id: 'a8893fb5-63ec-4b13-bb49-e6d4435cc5e4',
      name: 'RunnableSequence',
      type: 'chain',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:34.074Z',
      streamed_output_str: [],
      final_output: [Object],
      end_time: '2024-01-04T20:21:34.893Z'
    },
    VectorStoreRetriever: {
      id: 'd145704c-64bb-491d-9a2c-814ee3d1e6a2',
      name: 'VectorStoreRetriever',
      type: 'retriever',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:34.234Z',
      streamed_output_str: [],
      final_output: [Object],
      end_time: '2024-01-04T20:21:34.518Z'
    },
    RunnableLambda: {
      id: 'a23a552a-b96f-4c07-a45d-c5f3861fad5d',
      name: 'RunnableLambda',
      type: 'chain',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:34.610Z',
      streamed_output_str: [],
      final_output: [Object],
      end_time: '2024-01-04T20:21:34.785Z'
    },
    ChatPromptTemplate: {
      id: 'a5e8439e-a6e4-4cf3-ba17-c223ea874a0a',
      name: 'ChatPromptTemplate',
      type: 'prompt',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:35.097Z',
      streamed_output_str: [],
      final_output: [ChatPromptValue],
      end_time: '2024-01-04T20:21:35.193Z'
    },
    ChatOpenAI: {
      id: 'd9c9d340-ea38-4ef4-a8a8-60f52da4e838',
      name: 'ChatOpenAI',
      type: 'llm',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:35.282Z',
      streamed_output_str: [Array],
      final_output: [Object],
      end_time: '2024-01-04T20:21:36.059Z'
    },
    StrOutputParser: {
      id: 'c55f9f3f-048b-43d5-ba48-02f3b24b8f96',
      name: 'StrOutputParser',
      type: 'parser',
      tags: [Array],
      metadata: {},
      start_time: '2024-01-04T20:21:35.842Z',
      streamed_output_str: [],
      final_output: [Object],
      end_time: '2024-01-04T20:21:36.157Z'
    }
  }
}
 */

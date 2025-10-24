import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { MemoryVectorStore } from "../../../vectorstores/memory.js";
import { ViolationOfExpectationsChain } from "../violation_of_expectations/violation_of_expectations_chain.js";

const dummyMessages = [
  new HumanMessage(
    "I've been thinking about the importance of time with myself to discover my voice. I feel like 1-2 hours is never enough."
  ),
  new AIMessage(
    "The concept of 'adequate time' varies. Have you tried different formats of introspection, such as morning pages or long-form writing, to see if they make the process more efficient?"
  ),
  new HumanMessage(
    "I have tried journaling but never consistently. Sometimes it feels like writing doesn't capture everything."
  ),
];

test.skip("should respond with the proper schema", async () => {
  const vectorStore = await MemoryVectorStore.fromTexts(
    [" "],
    [{ id: 1 }],
    new OpenAIEmbeddings()
  );
  const retriever = vectorStore.asRetriever();

  const llm = new ChatOpenAI({
    model: "gpt-4",
  });
  const chain = new ViolationOfExpectationsChain({
    llm,
    retriever,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.call({
    chat_history: dummyMessages,
  });

  // console.log({
  //   res,
  // });
});

import { ChatOpenAI } from "../../chat_models/openai.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { dummyMessages } from "../violation_of_expectation/types.js";
import { ViolationOfExpectationChain } from "../violation_of_expectation/violation_of_expectation_chain.js";

test("should respond with the proper schema", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Mitochondria are the powerhouse of the cell", "Foo is red"],
    [{ id: 2 }, { id: 1 }],
    new OpenAIEmbeddings()
  );
  const retriever = vectorStore.asRetriever();

  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
  });
  const chain = new ViolationOfExpectationChain({
    llm,
    retriever,
  });

  const res = await chain.call({
    chat_history: dummyMessages,
  });

  console.log({
    res,
  });
});

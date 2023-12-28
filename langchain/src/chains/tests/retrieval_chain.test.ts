import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FakeRetriever } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { createRetrievalChain } from "../retrieval.js";
import { FakeListLLM } from "../../llms/fake.js";

test("createRetrievalChain", async () => {
  const answer = "I know the answer!";
  const combineDocsPrompt = ChatPromptTemplate.fromTemplate(
    `hi! {input} {chat_history}`
  );
  const fakeRetrievedDocs = [
    new Document({ pageContent: "some fake content" }),
  ];
  const llm = new FakeListLLM({ responses: [answer] });
  const input = "What is the answer?";
  const retriever = new FakeRetriever({
    output: fakeRetrievedDocs,
  });
  const chain = await createRetrievalChain({
    retriever,
    combineDocsChain: combineDocsPrompt.pipe(llm),
  });
  const output = await chain.invoke({ input });
  expect(output).toEqual({
    answer,
    chat_history: [],
    context: fakeRetrievedDocs,
    input,
  });

  const output2 = await chain.invoke({ input, chat_history: "foo" });
  expect(output2).toEqual({
    answer,
    chat_history: "foo",
    context: fakeRetrievedDocs,
    input,
  });
});

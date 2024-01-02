import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FakeRetriever } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { FakeListLLM } from "../../llms/fake.js";
import { createHistoryAwareRetriever } from "../history_aware_retriever.js";

test("createHistoryAwareRetriever", async () => {
  const answer = "I know the answer!";
  const questionGenPrompt = ChatPromptTemplate.fromTemplate(
    `hi! {input} {chat_history}`
  );
  const fakeRetrievedDocs = [
    new Document({ pageContent: "some fake content" }),
  ];
  const retriever = new FakeRetriever({
    output: fakeRetrievedDocs,
  });
  const llm = new FakeListLLM({ responses: [answer] });
  const input = "What is the answer?";
  const chain = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: questionGenPrompt,
  });
  const output = await chain.invoke({ input, chat_history: [] });
  expect(output).toEqual(fakeRetrievedDocs);

  const output2 = await chain.invoke({ input, chat_history: "foo" });
  expect(output2).toEqual(fakeRetrievedDocs);
});

import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FakeRetriever } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { FakeListLLM } from "../../llms/fake.js";
import { createChatRetrieverChain } from "../conversational_retrieval_chain.js";

test("createChatRetrieverChain", async () => {
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
  const chain = createChatRetrieverChain({
    llm,
    retriever,
    prompt: questionGenPrompt,
  });
  const output = await chain.invoke({ input, chat_history: [] });
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

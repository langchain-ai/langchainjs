import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai";
import { PromptTemplate } from "../../prompts";
import { LLMChain } from "../llm_chain";
import { loadChain } from "../load";
import { StuffDocumentsChain } from "../combine_docs_chain";
import { Document } from "../../document";

test("Test StuffDocumentsChain", async () => {
  const model = new OpenAI({});
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const llmChain = new LLMChain({ prompt, llm: model });
  const chain = new StuffDocumentsChain({
    llmChain,
    documentVariableName: "foo",
  });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs });
  console.log({ res });
});

test("Load chain from hub", async () => {
  const chain = await loadChain(
    "lc://chains/question_answering/stuff/chain.json"
  );
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "what up" });
  console.log({ res });
});

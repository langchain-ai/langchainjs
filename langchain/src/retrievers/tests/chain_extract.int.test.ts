import { test, expect } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { StuffDocumentsChain } from "../../chains/combine_docs_chain.js";
import { ConversationalRetrievalQAChain } from "../../chains/conversational_retrieval_chain.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { ContextualCompressionRetriever } from "../contextual_compression.js";
import { LLMChainExtractor } from "../document_compressors/chain_extract.js";

test("Test LLMChainExtractor", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = PromptTemplate.fromTemplate(
    "Print {question}, and ignore {chat_history}"
  );
  const baseCompressor = LLMChainExtractor.fromLLM(model);
  expect(baseCompressor).toBeDefined();

  const retriever = new ContextualCompressionRetriever({
    baseCompressor,
    baseRetriever: await HNSWLib.fromTexts(
      ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
      [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
      new OpenAIEmbeddings()
    ).then((vectorStore) => vectorStore.asRetriever()),
  });

  const llmChain = new LLMChain({ prompt, llm: model });
  const combineDocsChain = new StuffDocumentsChain({
    llmChain,
    documentVariableName: "foo",
  });
  const chain = new ConversationalRetrievalQAChain({
    retriever,
    combineDocumentsChain: combineDocsChain,
    questionGeneratorChain: llmChain,
  });
  const res = await chain.call({ question: "foo", chat_history: "bar" });

  expect(res.text.length).toBeGreaterThan(0);

  console.log({ res });
});

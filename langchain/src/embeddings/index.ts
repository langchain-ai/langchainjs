/* #__PURE__ */ console.error(
  "[WARN] Importing from 'langchain/embeddings' is deprecated. Import from eg. 'langchain/embeddings/openai' instead. See https://js.langchain.com/docs/getting-started/install#updating-from-0052 for upgrade instructions."
);

export { OpenAIEmbeddings } from "./openai.js";
export { CohereEmbeddings } from "./cohere.js";
export { Embeddings } from "./base.js";
export { FakeEmbeddings } from "./fake.js";

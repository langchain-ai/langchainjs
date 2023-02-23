/* eslint-disable */
import { PromptTemplate } from "../../prompts/index.js";

export const DEFAULT_QA_PROMPT = new PromptTemplate({
  template:
    "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
  inputVariables: ["context", "question"],
});

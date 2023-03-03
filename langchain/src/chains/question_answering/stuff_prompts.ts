/* eslint-disable */
import { ChatPromptTemplate, PromptTemplate } from "../../prompts/index.js";

export const DEFAULT_QA_PROMPT = new PromptTemplate({
  template:
    "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
  inputVariables: ["context", "question"],
});

const chatTemplateSystem = `Use the following pieces of context to answer any user questions. If you don't know the answer, just say that you don't know, don't try to make up an answer
{context}`;

export const DEFAULT_CHAT_QA_PROMPT = ChatPromptTemplate.fromPromptMessages([
  {
    role: "system",
    message: PromptTemplate.fromTemplate(chatTemplateSystem),
  },
  {
    role: "user",
    message: PromptTemplate.fromTemplate("{question}"),
  },
]);

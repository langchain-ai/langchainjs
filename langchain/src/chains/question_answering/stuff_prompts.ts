/* eslint-disable */
import {
  PromptTemplate,
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/index.js";
import { ConditionalPromptSelector, isChatModel } from "../prompt_selector.js";

export const DEFAULT_QA_PROMPT = new PromptTemplate({
  template:
    "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
  inputVariables: ["context", "question"],
});

const system_template = `Use the following pieces of context to answer the users question. 
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;
const messages = [
  SystemMessagePromptTemplate.fromTemplate(system_template),
  HumanMessagePromptTemplate.fromTemplate("{question}"),
];
const CHAT_PROMPT = ChatPromptTemplate.fromPromptMessages(messages);

export const QA_PROMPT_SELECTOR = new ConditionalPromptSelector(
  DEFAULT_QA_PROMPT,
  [[isChatModel, CHAT_PROMPT]]
);

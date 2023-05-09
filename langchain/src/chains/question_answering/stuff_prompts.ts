/* eslint-disable spaced-comment */
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/chat.js";
import {
  BasePromptTemplateGenerator,
  ConditionalPromptSelector,
  isChatModel,
} from "../prompt_selector.js";

export const GET_DEFAULT_QA_PROMPT: BasePromptTemplateGenerator = (options) =>
  new PromptTemplate({
    template:
      "{prefix}\n\nUse the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
    inputVariables: ["context", "question"],
    partialVariables: {
      prefix: options?.partialVariables?.prefix ?? "",
    },
  });

const system_template = `{prefix}
Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;
const GET_CHAT_PROMPT: BasePromptTemplateGenerator = (options) => {
  const messages = [
    SystemMessagePromptTemplate.fromTemplate(system_template),
    HumanMessagePromptTemplate.fromTemplate("{question}"),
  ];
  return new ChatPromptTemplate({
    promptMessages: messages,
    inputVariables: ["context", "question"],
    partialVariables: { prefix: options?.partialVariables?.prefix ?? "" },
  });
};

export const QA_PROMPT_SELECTOR = new ConditionalPromptSelector(
  GET_DEFAULT_QA_PROMPT,
  [[isChatModel, GET_CHAT_PROMPT]]
);

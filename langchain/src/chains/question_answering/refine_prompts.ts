/* eslint-disable spaced-comment */
import {
  PromptTemplate,
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  AIMessagePromptTemplate,
} from "../../prompts/index.js";
import { ConditionalPromptSelector, isChatModel } from "../prompt_selector.js";

export const DEFAULT_REFINE_PROMPT_TMPL = `The original question is as follows: {question}
We have provided an existing answer: {existing_answer}
We have the opportunity to refine the existing answer
(only if needed) with some more context below.
------------
{context}
------------
Given the new context, refine the original answer to better answer the question. 
If the context isn't useful, return the original answer.`;
export const DEFAULT_REFINE_PROMPT = /*#__PURE__*/ new PromptTemplate({
  inputVariables: ["question", "existing_answer", "context"],
  template: DEFAULT_REFINE_PROMPT_TMPL,
});

const refineTemplate = `The original question is as follows: {question}
We have provided an existing answer: {existing_answer}
We have the opportunity to refine the existing answer
(only if needed) with some more context below.
------------
{context}
------------
Given the new context, refine the original answer to better answer the question. 
If the context isn't useful, return the original answer.`;

const messages = [
  /*#__PURE__*/ HumanMessagePromptTemplate.fromTemplate("{question}"),
  /*#__PURE__*/ AIMessagePromptTemplate.fromTemplate("{existing_answer}"),
  /*#__PURE__*/ HumanMessagePromptTemplate.fromTemplate(refineTemplate),
];

export const CHAT_REFINE_PROMPT =
  /*#__PURE__*/ ChatPromptTemplate.fromPromptMessages(messages);

export const REFINE_PROMPT_SELECTOR =
  /*#__PURE__*/ new ConditionalPromptSelector(DEFAULT_REFINE_PROMPT, [
    [isChatModel, CHAT_REFINE_PROMPT],
  ]);

export const DEFAULT_TEXT_QA_PROMPT_TMPL = `Context information is below. 
---------------------
{context}
---------------------
Given the context information and not prior knowledge, answer the question: {question}`;
export const DEFAULT_TEXT_QA_PROMPT = /*#__PURE__*/ new PromptTemplate({
  inputVariables: ["context", "question"],
  template: DEFAULT_TEXT_QA_PROMPT_TMPL,
});

const chat_qa_prompt_template = `Context information is below. 
---------------------
{context}
---------------------
Given the context information and not prior knowledge, answer any questions`;
const chat_messages = [
  /*#__PURE__*/ SystemMessagePromptTemplate.fromTemplate(
    chat_qa_prompt_template
  ),
  /*#__PURE__*/ HumanMessagePromptTemplate.fromTemplate("{question}"),
];
export const CHAT_QUESTION_PROMPT =
  /*#__PURE__*/ ChatPromptTemplate.fromPromptMessages(chat_messages);
export const QUESTION_PROMPT_SELECTOR =
  /*#__PURE__*/ new ConditionalPromptSelector(DEFAULT_TEXT_QA_PROMPT, [
    [isChatModel, CHAT_QUESTION_PROMPT],
  ]);

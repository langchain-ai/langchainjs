/* eslint-disable spaced-comment */
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/chat.js";
import {
  ConditionalPromptSelector,
  isChatModel,
} from "../../prompts/selectors/conditional.js";

const qa_template = `Use the following portion of a long document to see if any of the text is relevant to answer the question. 
Return any relevant text verbatim.
{context}
Question: {question}
Relevant text, if any:`;
export const DEFAULT_COMBINE_QA_PROMPT =
  /*#__PURE__*/
  PromptTemplate.fromTemplate(qa_template);

const system_template = `Use the following portion of a long document to see if any of the text is relevant to answer the question. 
Return any relevant text verbatim.
----------------
{context}`;
const messages = [
  /*#__PURE__*/ SystemMessagePromptTemplate.fromTemplate(system_template),
  /*#__PURE__*/ HumanMessagePromptTemplate.fromTemplate("{question}"),
];
const CHAT_QA_PROMPT = /*#__PURE__*/ ChatPromptTemplate.fromMessages(messages);

export const COMBINE_QA_PROMPT_SELECTOR =
  /*#__PURE__*/ new ConditionalPromptSelector(DEFAULT_COMBINE_QA_PROMPT, [
    [isChatModel, CHAT_QA_PROMPT],
  ]);

const combine_prompt = `Given the following extracted parts of a long document and a question, create a final answer. 
If you don't know the answer, just say that you don't know. Don't try to make up an answer.

=========
QUESTION: {question}
=========
SUMMARIES: {summaries}
=========
FINAL ANSWER:`

export const COMBINE_PROMPT =
  /*#__PURE__*/ PromptTemplate.fromTemplate(combine_prompt);

const system_combine_template = `Given the following extracted parts of a long document and a question, create a final answer. 
If you don't know the answer, just say that you don't know. Don't try to make up an answer.
----------------
{summaries}`;
const combine_messages = [
  /*#__PURE__*/ SystemMessagePromptTemplate.fromTemplate(
    system_combine_template
  ),
  /*#__PURE__*/ HumanMessagePromptTemplate.fromTemplate("{question}"),
];
const CHAT_COMBINE_PROMPT =
  /*#__PURE__*/ ChatPromptTemplate.fromMessages(combine_messages);

export const COMBINE_PROMPT_SELECTOR =
  /*#__PURE__*/ new ConditionalPromptSelector(COMBINE_PROMPT, [
    [isChatModel, CHAT_COMBINE_PROMPT],
  ]);

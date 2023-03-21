/* eslint-disable tree-shaking/no-side-effects-in-initialization */
/* eslint-disable spaced-comment */
import { KeyValueOutputParser } from "../../output_parsers/key_value.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/index.js";

import { ConditionalPromptSelector, isChatModel } from "../prompt_selector.js";

export const QA_WITH_SOURCES_OUTPUT_PARSER =
  /*#__PURE__*/ new KeyValueOutputParser(["FINAL ANSWER", "SOURCES"]);

const DEFAULT_QA_PROMPT = /*#__PURE__*/ new PromptTemplate({
  template:
    "Use the following pieces of context to answer the question at the end, with references to the pieces of context you used (SOURCES). If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{format_instructions}\n\n{context}\n\nQuestion: {question}\nHelpful Answer:",
  inputVariables: ["context", "question"],
  outputParser: QA_WITH_SOURCES_OUTPUT_PARSER,
});

const system_template = `Use the following pieces of context to answer the users question, with references the the pieces of context you used (SOURCES).
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{format_instructions}
----------------
{context}`;
const messages = [
  /*#__PURE__*/ SystemMessagePromptTemplate.fromTemplate(system_template, {
    outputParser: QA_WITH_SOURCES_OUTPUT_PARSER,
  }),
  /*#__PURE__*/ HumanMessagePromptTemplate.fromTemplate("{question}"),
];
const CHAT_PROMPT =
  /*#__PURE__*/ ChatPromptTemplate.fromPromptMessages(messages);

export const QA_WITH_SOURCES_PROMPT_SELECTOR =
  /*#__PURE__*/ new ConditionalPromptSelector(DEFAULT_QA_PROMPT, [
    [isChatModel, CHAT_PROMPT],
  ]);

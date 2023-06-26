import { PromptTemplate } from "../../prompts/prompt.js";

const QA_TEMPLATE = `You are a teacher grading a quiz.
You are given a question, the student's answer, and the true answer, and are asked to score the student answer as either CORRECT or INCORRECT.

Example Format:
QUESTION: question here
STUDENT ANSWER: student's answer here
TRUE ANSWER: true answer here
GRADE: CORRECT or INCORRECT here

Grade the student answers based ONLY on their factual accuracy. Ignore differences in punctuation and phrasing between the student answer and true answer. It is OK if the student answer contains more information than the true answer, as long as it does not contain any conflicting statements. Begin! 

QUESTION: {query}
STUDENT ANSWER: {result}
TRUE ANSWER: {answer}
GRADE:`;
export const QA_PROMPT = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["query", "result", "answer"],
  template: QA_TEMPLATE,
});

const SQL_TEMPLATE = `You are comparing a submitted answer to an expert answer on a given SQL coding question. Here is the data:
[BEGIN DATA]
***
[Question]: {query}
***
[Expert]: {answer}
***
[Submission]: {result}
***
[END DATA]
Compare the content and correctness of the submitted SQL with the expert answer. Ignore any differences in whitespace, style, or output column names. The submitted answer may either be correct or incorrect. Determine which case applies. First, explain in detail the similarities or differences between the expert answer and the submission, ignoring superficial aspects such as whitespace, style or output column names. Do not state the final answer in your initial explanation. Then, respond with either "CORRECT" or "INCORRECT" (without quotes or punctuation) on its own line. This should correspond to whether the submitted SQL and the expert answer are semantically the same or different, respectively. Then, repeat your final answer on a new line.`;

export const SQL_PROMPT = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["query", "answer", "result"],
  template: SQL_TEMPLATE,
});

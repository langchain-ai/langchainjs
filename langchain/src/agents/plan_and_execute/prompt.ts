import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "../../prompts/chat.js";

export const PREFIX = `Answer the following questions as best you can. You have access to the following tools:`;
export const FORMAT_INSTRUCTIONS = `Let's first understand the problem, extract relevant variables and their corresponding numerals, and devise a complete plan.
Do not execute the plan or any steps yet - we will do that later. Keep in mind any intermediate results you would need to calculate or determine to solve the problem step by step.

Use the following format in your response:

Question: the input question you must answer
Variables: the extracted relevant variables from the question and their corresponding numerals
Plan Step n: A detailed step in your plan
`;

export const SUFFIX = `Begin!

Question: {input}`;

export const SYSTEM_PROMPT = `Let's first understand the problem and devise a plan to solve the problem.
Please output the plan starting with the header "Plan:"
and then followed by a numbered list of steps.
Please make the plan the minimum number of steps required
to accurately complete the task. If the task is a question,
the final step should almost always be 'Given the above steps taken,
please respond to the users original question'.
At the end of your plan, say '<END_OF_PLAN>'`;

export const CHAT_PROMPT = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
  HumanMessagePromptTemplate.fromTemplate(`{input}`)
]);

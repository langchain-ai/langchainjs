import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";

export const PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE = [
  `Let's first understand the problem and devise a plan to solve the problem.`,
  `Please output the plan starting with the header 'Plan:'`,
  `and then followed by a numbered list of steps.`,
  `Please make the plan the minimum number of steps required`,
  `to accurately complete the task. If the task is a question,`,
  `the final step should almost always be 'Given the above steps taken,`,
  `please respond to the users original question'.`,
  `At the end of your plan, say '<END_OF_PLAN>'`,
].join(" ");

export const PLANNER_CHAT_PROMPT = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE
  ),
  HumanMessagePromptTemplate.fromTemplate(`{input}`),
]);

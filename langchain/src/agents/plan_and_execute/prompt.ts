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
  `while also completing the task to the highest degree of accuracy and precision possible,`,
  `and try to return exactly what the user asks for. If the task is a question,`,
  `the final step must be: 'Given the above steps taken,`,
  `please respond to the original query.`,
  `At the end of your plan, say '<END_OF_PLAN>'`,
].join(" ");

export const PLANNER_CHAT_PROMPT =
  /* #__PURE__ */ ChatPromptTemplate.fromPromptMessages([
    /* #__PURE__ */ SystemMessagePromptTemplate.fromTemplate(
      PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE
    ),
    /* #__PURE__ */ HumanMessagePromptTemplate.fromTemplate(`{input}`),
  ]);

export const DEFAULT_STEP_EXECUTOR_HUMAN_CHAT_MESSAGE_TEMPLATE = `Previous steps: {previous_steps}

Current objective: {current_step}

{agent_scratchpad}

You may extract and combine relevant data from your previous steps when responding to me.`;

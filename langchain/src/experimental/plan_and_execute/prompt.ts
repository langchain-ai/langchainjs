import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";

import { Tool } from "../../tools/base.js";
import { DynamicStructuredTool } from "../../tools/dynamic.js";

export let PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE: string

export const DEFAULT_STEP_EXECUTOR_HUMAN_CHAT_MESSAGE_TEMPLATE = `Previous steps: {previous_steps}

Current objective: {current_step}

{agent_scratchpad}

You may extract and combine relevant data from your previous steps when responding to me.`;

/**
 * Add the tool descriptions to the planning system prompt in
 * order to get a better suited plan that makes efficient use
 * of the tools
 * @param tools the tools available to the `planner`
 * @returns
 */
export const getPlannerChatPrompt = (tools?: Tool[] | DynamicStructuredTool[]) => {
  const toolStrings = tools
    ? tools.map((tool) => `${tool.name}: ${tool.description}`).join("\n")
    : "";

  const toolInstruction = tools
    ? `You have a set of tools at your disposal to help you with this task: ${toolStrings}. You must consider these tools when coming up with your plan.`
    : `Your steps should be general, and should not require a specific method to solve a step.`;

    PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE = [
    `Let's first understand the problem and devise a plan to solve the problem.`,
    `Please output the plan starting with the header "Plan:"`,
    `followed by a numbered list of steps.`,
    `Please make the plan the minimum number of steps required`,
    `to answer the query or complete the task accurately and precisely.`,
    `${toolInstruction}`,
    `If the task is a question, the final step in the plan must be the following: "Given the above steps taken,`,
    `please respond to the original query."`,
    `At the end of your plan, say "<END_OF_PLAN>"`,
  ].join(" ");


  return /* #__PURE__ */ ChatPromptTemplate.fromMessages([
    /* #__PURE__ */ SystemMessagePromptTemplate.fromTemplate(
        PLANNER_SYSTEM_PROMPT_MESSAGE_TEMPLATE
    ),
    /* #__PURE__ */ HumanMessagePromptTemplate.fromTemplate(`{input}`),
  ]);
};

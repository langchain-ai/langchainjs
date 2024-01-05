import { renderTemplate } from "../../prompts/template.js";
import {
  AIMessage,
  AgentStep,
  BaseMessage,
  HumanMessage,
  FunctionMessage,
} from "../../schema/index.js";
import { TEMPLATE_TOOL_RESPONSE } from "../chat_convo/prompt.js";

/**
 * Format a list of AgentSteps into a list of BaseMessage instances for
 * agents that use OpenAI's API. Helpful for passing in previous agent
 * step context into new iterations.
 *
 * @deprecated Use formatToOpenAIFunctionMessages instead.
 * @param steps A list of AgentSteps to format.
 * @returns A list of BaseMessages.
 */
export function formatForOpenAIFunctions(steps: AgentStep[]): BaseMessage[] {
  const thoughts: BaseMessage[] = [];
  for (const step of steps) {
    thoughts.push(new AIMessage(step.action.log));
    thoughts.push(
      new HumanMessage(
        renderTemplate(TEMPLATE_TOOL_RESPONSE, "f-string", {
          observation: step.observation,
        })
      )
    );
  }
  return thoughts;
}

/**
 * Format a list of AgentSteps into a list of BaseMessage instances for
 * agents that use OpenAI's API. Helpful for passing in previous agent
 * step context into new iterations.
 *
 * @param steps A list of AgentSteps to format.
 * @returns A list of BaseMessages.
 */
export function formatToOpenAIFunctionMessages(
  steps: AgentStep[]
): BaseMessage[] {
  return steps.flatMap(({ action, observation }) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      return log.concat(new FunctionMessage(observation, action.tool));
    } else {
      return [new AIMessage(action.log)];
    }
  });
}

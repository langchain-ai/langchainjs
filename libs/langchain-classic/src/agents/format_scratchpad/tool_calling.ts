import { AIMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";
import { ToolsAgentStep } from "../tool_calling/output_parser.js";

/**
 * Convert agent action and observation into a function message.
 * @param agentAction - The tool invocation request from the agent
 * @param observation - The result of the tool invocation
 * @returns FunctionMessage that corresponds to the original tool invocation
 */
export function _createToolMessage(step: ToolsAgentStep): ToolMessage {
  return new ToolMessage({
    tool_call_id: step.action.toolCallId,
    content: step.observation,
    additional_kwargs: { name: step.action.tool },
  });
}

export function formatToToolMessages(steps: ToolsAgentStep[]): BaseMessage[] {
  return steps.flatMap(({ action, observation }) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      return log.concat(_createToolMessage({ action, observation }));
    } else {
      return [new AIMessage(action.log)];
    }
  });
}

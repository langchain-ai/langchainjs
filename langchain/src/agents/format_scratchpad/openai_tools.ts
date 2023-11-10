import type { ToolsAgentStep } from "../openai/output_parser.js";
import {
  type BaseMessage,
  ToolMessage,
  AIMessage,
} from "../../schema/index.js";

export function formatToOpenAIToolMessages(
  steps: ToolsAgentStep[]
): BaseMessage[] {
  return steps.flatMap(({ action, observation }) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      return log.concat(
        new ToolMessage({
          content: observation,
          tool_call_id: action.toolCallId,
        })
      );
    } else {
      return [new AIMessage(action.log)];
    }
  });
}

import { AgentAction, AgentFinish, AgentStep } from "@langchain/core/agents";
import {
  AIMessage,
  BaseMessage,
  isBaseMessage,
} from "@langchain/core/messages";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatGeneration } from "@langchain/core/outputs";
import { ToolCall } from "@langchain/core/messages/tool";
import { AgentMultiActionOutputParser } from "../types.js";

/**
 * Type that represents an agent action with an optional message log.
 */
export type ToolsAgentAction = AgentAction & {
  toolCallId: string;
  messageLog?: BaseMessage[];
};

export type ToolsAgentStep = AgentStep & {
  action: ToolsAgentAction;
};

export function parseAIMessageToToolAction(
  message: AIMessage
): ToolsAgentAction[] | AgentFinish {
  const stringifiedMessageContent =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  let toolCalls: ToolCall[] = [];
  if (message.tool_calls !== undefined && message.tool_calls.length > 0) {
    toolCalls = message.tool_calls;
  } else {
    if (
      !message.additional_kwargs.tool_calls ||
      message.additional_kwargs.tool_calls.length === 0
    ) {
      return {
        returnValues: { output: message.content },
        log: stringifiedMessageContent,
      };
    }
    // Best effort parsing
    for (const toolCall of message.additional_kwargs.tool_calls ?? []) {
      const functionName = toolCall.function?.name;
      try {
        const args = JSON.parse(toolCall.function.arguments);
        toolCalls.push({ name: functionName, args, id: toolCall.id });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        throw new OutputParserException(
          `Failed to parse tool arguments from chat model response. Text: "${JSON.stringify(
            toolCalls
          )}". ${e}`
        );
      }
    }
  }
  return toolCalls.map((toolCall, i) => {
    const messageLog = i === 0 ? [message] : [];
    const log = `Invoking "${toolCall.name}" with ${JSON.stringify(
      toolCall.args ?? {}
    )}\n${stringifiedMessageContent}`;
    return {
      tool: toolCall.name as string,
      toolInput: toolCall.args,
      toolCallId: toolCall.id ?? "",
      log,
      messageLog,
    };
  });
}

export class ToolCallingAgentOutputParser extends AgentMultiActionOutputParser {
  lc_namespace = ["langchain", "agents", "tool_calling"];

  static lc_name() {
    return "ToolCallingAgentOutputParser";
  }

  async parse(text: string): Promise<AgentAction[] | AgentFinish> {
    throw new Error(
      `ToolCallingAgentOutputParser can only parse messages.\nPassed input: ${text}`
    );
  }

  async parseResult(generations: ChatGeneration[]) {
    if ("message" in generations[0] && isBaseMessage(generations[0].message)) {
      return parseAIMessageToToolAction(generations[0].message);
    }
    throw new Error(
      "parseResult on ToolCallingAgentOutputParser only works on ChatGeneration output"
    );
  }

  getFormatInstructions(): string {
    throw new Error(
      "getFormatInstructions not implemented inside ToolCallingAgentOutputParser."
    );
  }
}

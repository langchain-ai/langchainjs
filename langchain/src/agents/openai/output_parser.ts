import type { OpenAI as OpenAIClient } from "openai";
import {
  AgentAction,
  AgentFinish,
  BaseMessage,
  ChatGeneration,
  isBaseMessage,
} from "../../schema/index.js";
import { AgentActionOutputParser } from "../types.js";
import { OutputParserException } from "../../schema/output_parser.js";

/**
 * Type that represents an agent action with an optional message log.
 */
export type FunctionsAgentAction = AgentAction & {
  messageLog?: BaseMessage[];
};

export class OpenAIFunctionsAgentOutputParser extends AgentActionOutputParser {
  lc_namespace = ["langchain", "agents", "openai"];

  static lc_name() {
    return "OpenAIFunctionsAgentOutputParser";
  }

  async parse(text: string): Promise<AgentAction | AgentFinish> {
    throw new Error(
      `OpenAIFunctionsAgentOutputParser can only parse messages.\nPassed input: ${text}`
    );
  }

  async parseResult(generations: ChatGeneration[]) {
    if ("message" in generations[0] && isBaseMessage(generations[0].message)) {
      return this.parseAIMessage(generations[0].message);
    }
    throw new Error(
      "parseResult on OpenAIFunctionsAgentOutputParser only works on ChatGeneration output"
    );
  }

  /**
   * Parses the output message into a FunctionsAgentAction or AgentFinish
   * object.
   * @param message The BaseMessage to parse.
   * @returns A FunctionsAgentAction or AgentFinish object.
   */
  parseAIMessage(message: BaseMessage): FunctionsAgentAction | AgentFinish {
    if (message.additional_kwargs.function_call) {
      // eslint-disable-next-line prefer-destructuring
      const function_call: OpenAIClient.Chat.ChatCompletionMessage.FunctionCall =
        message.additional_kwargs.function_call;
      try {
        const toolInput = function_call.arguments
          ? JSON.parse(function_call.arguments)
          : {};
        return {
          tool: function_call.name as string,
          toolInput,
          log: `Invoking "${function_call.name}" with ${
            function_call.arguments ?? "{}"
          }\n${message.content}`,
          messageLog: [message],
        };
      } catch (error) {
        throw new OutputParserException(
          `Failed to parse function arguments from chat model response. Text: "${function_call.arguments}". ${error}`
        );
      }
    } else {
      return {
        returnValues: { output: message.content },
        log: message.content,
      };
    }
  }

  getFormatInstructions(): string {
    throw new Error(
      "getFormatInstructions not implemented inside OpenAIFunctionsAgentOutputParser."
    );
  }
}

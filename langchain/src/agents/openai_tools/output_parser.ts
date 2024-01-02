import type { OpenAIClient } from "@langchain/openai";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
  ChatGeneration,
  isBaseMessage,
} from "../../schema/index.js";
import { AgentMultiActionOutputParser } from "../types.js";
import { OutputParserException } from "../../schema/output_parser.js";

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

/**
 * @example
 * ```typescript
 *
 * const prompt = ChatPromptTemplate.fromMessages([
 *   ["ai", "You are a helpful assistant"],
 *   ["human", "{input}"],
 *   new MessagesPlaceholder("agent_scratchpad"),
 * ]);
 *
 * const runnableAgent = RunnableSequence.from([
 *   {
 *     input: (i: { input: string; steps: ToolsAgentStep[] }) => i.input,
 *     agent_scratchpad: (i: { input: string; steps: ToolsAgentStep[] }) =>
 *       formatToOpenAIToolMessages(i.steps),
 *   },
 *   prompt,
 *   new ChatOpenAI({
 *     modelName: "gpt-3.5-turbo-1106",
 *     temperature: 0,
 *   }).bind({ tools: tools.map(formatToOpenAITool) }),
 *   new OpenAIToolsAgentOutputParser(),
 * ]).withConfig({ runName: "OpenAIToolsAgent" });
 *
 * const result = await runnableAgent.invoke({
 *   input:
 *     "What is the sum of the current temperature in San Francisco, New York, and Tokyo?",
 * });
 *
 * ```
 */
export class OpenAIToolsAgentOutputParser extends AgentMultiActionOutputParser {
  lc_namespace = ["langchain", "agents", "openai"];

  static lc_name() {
    return "OpenAIToolsAgentOutputParser";
  }

  async parse(text: string): Promise<AgentAction[] | AgentFinish> {
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
   * Parses the output message into a ToolsAgentAction[] or AgentFinish
   * object.
   * @param message The BaseMessage to parse.
   * @returns A ToolsAgentAction[] or AgentFinish object.
   */
  parseAIMessage(message: BaseMessage): ToolsAgentAction[] | AgentFinish {
    if (message.content && typeof message.content !== "string") {
      throw new Error("This agent cannot parse non-string model responses.");
    }
    if (message.additional_kwargs.tool_calls) {
      const toolCalls: OpenAIClient.Chat.ChatCompletionMessageToolCall[] =
        message.additional_kwargs.tool_calls;
      try {
        return toolCalls.map((toolCall, i) => {
          const toolInput = toolCall.function.arguments
            ? JSON.parse(toolCall.function.arguments)
            : {};
          const messageLog = i === 0 ? [message] : [];
          return {
            tool: toolCall.function.name as string,
            toolInput,
            toolCallId: toolCall.id,
            log: `Invoking "${toolCall.function.name}" with ${
              toolCall.function.arguments ?? "{}"
            }\n${message.content}`,
            messageLog,
          };
        });
      } catch (error) {
        throw new OutputParserException(
          `Failed to parse tool arguments from chat model response. Text: "${JSON.stringify(
            toolCalls
          )}". ${error}`
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
      "getFormatInstructions not implemented inside OpenAIToolsAgentOutputParser."
    );
  }
}

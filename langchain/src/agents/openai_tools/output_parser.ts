import type { OpenAIClient } from "@langchain/openai";
import { AgentAction, AgentFinish, AgentStep } from "@langchain/core/agents";
import { BaseMessage, isBaseMessage } from "@langchain/core/messages";
import { ChatGeneration } from "@langchain/core/outputs";
import { OutputParserException } from "@langchain/core/output_parsers";
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
 *   }).bind({ tools: tools.map(convertToOpenAITool) }),
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
    let messageContent = message.content;

    if (Array.isArray(messageContent)) {
      // Account for `MessageContentText` response types.
      const messageTexts = messageContent
        .map((item) => {
          if ("text" in item) {
            return item.text;
          }
          return null;
        })
        .filter((item): item is string => item !== null);
      // If we were to join above, then messageContent would always be
      // at least a single, empty string because `.map` always returns an array.
      // This way we only set messageContent if there are actually texts.
      if (messageTexts.length) {
        messageContent = messageTexts.join("");
      }
    }
    if (messageContent && typeof messageContent !== "string") {
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
            }\n${messageContent}`,
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
        returnValues: { output: messageContent },
        log: messageContent,
      };
    }
  }

  getFormatInstructions(): string {
    throw new Error(
      "getFormatInstructions not implemented inside OpenAIToolsAgentOutputParser."
    );
  }
}

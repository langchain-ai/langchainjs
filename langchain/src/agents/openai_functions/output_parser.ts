import type { OpenAIClient } from "@langchain/openai";
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
 * const modelWithFunctions = new ChatOpenAI({
 *   modelName: "gpt-4",
 *   temperature: 0,
 * }).bind({
 *   functions: tools.map((tool) => formatToOpenAIFunction(tool)),
 * });
 *
 * const runnableAgent = RunnableSequence.from([
 *   {
 *     input: (i) => i.input,
 *     agent_scratchpad: (i) => formatAgentSteps(i.steps),
 *   },
 *   prompt,
 *   modelWithFunctions,
 *   new OpenAIFunctionsAgentOutputParser(),
 * ]);
 *
 * const result = await runnableAgent.invoke({
 *   input: "What is the weather in New York?",
 *   steps: agentSteps,
 * });
 *
 * ```
 */
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
    if (message.content && typeof message.content !== "string") {
      throw new Error("This agent cannot parse non-string model responses.");
    }
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

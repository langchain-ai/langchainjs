import { XMLParser } from "fast-xml-parser";

import { BaseChatModelParams } from "../../chat_models/base.js";
import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import {
  AIMessage,
  BaseMessage,
  ChatResult,
  SystemMessage,
} from "../../schema/index.js";
import {
  ChatAnthropic,
  DEFAULT_STOP_SEQUENCES,
  type AnthropicInput,
} from "../../chat_models/anthropic.js";
import { BaseFunctionCallOptions } from "../../base_language/index.js";
import { StructuredTool } from "../../tools/base.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { formatToOpenAIFunction } from "../../tools/convert_to_openai.js";

const TOOL_SYSTEM_PROMPT =
  /* #__PURE__ */
  PromptTemplate.fromTemplate(`In addition to responding, you can use tools.
You have access to the following tools.

{tools}

In order to use a tool, you can use <tool></tool> to specify the name,
and the <tool_input></tool_input> tags to specify the parameters.
Each parameter should be passed in as <$param_name>$value</$param_name>,
Where $param_name is the name of the specific parameter, and $value
is the value for that parameter.

You will then get back a response in the form <observation></observation>
For example, if you have a tool called 'search' that accepts a single
parameter 'query' that could run a google search, in order to search
for the weather in SF you would respond:

<tool>search</tool><tool_input><query>weather in SF</query></tool_input>
<observation>64 degrees</observation>`);

export interface ChatAnthropicFunctionsCallOptions
  extends BaseFunctionCallOptions {
  tools?: StructuredTool[];
}

export class AnthropicFunctions extends ChatAnthropic<ChatAnthropicFunctionsCallOptions> {
  static lc_name(): string {
    return "AnthropicFunctions";
  }

  constructor(fields?: Partial<AnthropicInput> & BaseChatModelParams) {
    super(fields ?? {});
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    let promptMessages = messages;
    let forced = false;
    let functionCall: string | undefined;
    if (options.tools) {
      // eslint-disable-next-line no-param-reassign
      options.functions = (options.functions ?? []).concat(
        options.tools.map(formatToOpenAIFunction)
      );
    }
    if (options.functions !== undefined && options.functions.length > 0) {
      const content = await TOOL_SYSTEM_PROMPT.format({
        tools: JSON.stringify(options.functions, null, 2),
      });
      const systemMessage = new SystemMessage({ content });
      promptMessages = [systemMessage].concat(promptMessages);
      const stopSequences =
        options?.stop?.concat(DEFAULT_STOP_SEQUENCES) ??
        this.stopSequences ??
        DEFAULT_STOP_SEQUENCES;
      // eslint-disable-next-line no-param-reassign
      options.stop = stopSequences.concat(["</tool_input>"]);
      if (options.function_call) {
        if (typeof options.function_call === "string") {
          functionCall = JSON.parse(options.function_call).name;
        } else {
          functionCall = options.function_call.name;
        }
        forced = true;
        const matchingFunction = options.functions.find(
          (tool) => tool.name === functionCall
        );
        if (!matchingFunction) {
          throw new Error(
            `No matching function found for passed "function_call"`
          );
        }
        promptMessages = promptMessages.concat([
          new AIMessage({
            content: `<tool>${functionCall}</tool>`,
          }),
        ]);
        // eslint-disable-next-line no-param-reassign
        delete options.function_call;
      }
      // eslint-disable-next-line no-param-reassign
      delete options.functions;
    } else if (options.function_call !== undefined) {
      throw new Error(
        `If "function_call" is provided, "functions" must also be.`
      );
    }
    const chatResult = await super._generate(
      promptMessages,
      options,
      runManager
    );
    const chatGenerationContent = chatResult.generations[0].message.content;
    if (forced) {
      const parser = new XMLParser();
      const result = parser.parse(`${chatGenerationContent}</tool_input>`);
      if (functionCall === undefined) {
        throw new Error(`Could not parse called function from model output.`);
      }
      const responseMessageWithFunctions = new AIMessage({
        content: "",
        additional_kwargs: {
          function_call: {
            name: functionCall,
            arguments: result.tool_input
              ? JSON.stringify(result.tool_input)
              : "",
          },
        },
      });
      return {
        generations: [{ message: responseMessageWithFunctions, text: "" }],
      };
    } else if (chatGenerationContent.includes("<tool>")) {
      const parser = new XMLParser();
      const result = parser.parse(`${chatGenerationContent}</tool_input>`);
      const responseMessageWithFunctions = new AIMessage({
        content: chatGenerationContent.split("<tool>")[0],
        additional_kwargs: {
          function_call: {
            name: result.tool,
            arguments: result.tool_input
              ? JSON.stringify(result.tool_input)
              : "",
          },
        },
      });
      return {
        generations: [{ message: responseMessageWithFunctions, text: "" }],
      };
    }
    return chatResult;
  }

  _llmType(): string {
    return "anthropic_functions";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}

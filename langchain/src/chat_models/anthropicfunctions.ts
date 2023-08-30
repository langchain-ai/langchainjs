import {
  ChatCompletionFunctions,
  CreateChatCompletionRequestFunctionCall,
} from "openai";
import { BaseMessage, ChatResult } from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { AnthropicInput, ChatAnthropic } from "./anthropic.js";
import { StructuredTool } from "../tools/index.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { BaseChatModel, BaseChatModelParams } from "./base.js";
import { SystemMessagePromptTemplate } from "../prompts/index.js";

const prompt = `In addition to responding, you can use tools. \
You have access to the following tools.

{tools}

In order to use a tool, you can use <tool></tool> to specify the name, \
and the <tool_input></tool_input> tags to specify the parameters. \
Each parameter should be passed in as <$param_name>$value</$param_name>, \
Where $param_name is the name of the specific parameter, and $value \
is the value for that parameter.

For example, if you have a tool called 'search' that accepts a single \
parameter 'query' that could run a google search, in order to search \
for the weather in SF you would respond:

<tool>search</tool><tool_input><query>weather in SF</query></tool_input>
`;

export interface ChatOpenAICallOptions extends BaseLanguageModelCallOptions {
  function_call?: CreateChatCompletionRequestFunctionCall;
  functions?: ChatCompletionFunctions[];
  tools?: StructuredTool[];
}

/**
 * Wrapper around Minimax large language models that use the Chat endpoint.
 *
 */
export class ChatAnthropicFunctions extends BaseChatModel<ChatOpenAICallOptions> {
  model: ChatAnthropic;

  forced: boolean;

  function_call: CreateChatCompletionRequestFunctionCall;

  static lc_name() {
    return "ChatAnthropicFunctions";
  }

  constructor(fields?: Partial<AnthropicInput> & BaseChatModelParams) {
    super({});
    this.model = new ChatAnthropic(fields);
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const newOptions = { ...options };
    if (options.functions) {
      const systemMessage = await SystemMessagePromptTemplate.fromTemplate(
        prompt
      ).format({ tools: JSON.stringify(options.functions) });
      // put to the front of the messages
      messages.unshift(systemMessage);
      if (!options.stop) {
        newOptions.stop = ["</tool_input>"];
      } else {
        newOptions.stop?.push("</tool_input>");
      }
      if (options.function_call) {
        this.forced = true;
        // if options.function_call is string , this.function_call = options.function_call
        // else if options.function_call is object , this.function_call = options.function_call.name
        if (typeof options.function_call === "string") {
          this.function_call = options.function_call;
        } else if (typeof options.function_call === "object") {
          this.function_call = options.function_call.name;
        }
      }
    } else {
      if (options.function_call) {
        throw new Error(
          "if `function_call` provided, `functions` must also be"
        );
      }
    }

    const generations = await this.model._generate(
      messages,
      options,
      runManager
    );

    console.log("generations", JSON.stringify(generations));

    const ll = generations.generations;
    const { text } = ll[0];
    console.log("text", text);

    return generations;
  }

  _llmType() {
    return "anthropicFunction";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}

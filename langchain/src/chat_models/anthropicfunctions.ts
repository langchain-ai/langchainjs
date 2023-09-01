import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { AIMessage, BaseMessage, ChatResult } from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { AnthropicInput, ChatAnthropic } from "./anthropic.js";
import { FunctionCallOptions } from "../base_language/index.js";
import { BaseChatModel, BaseChatModelParams } from "./base.js";
import { SystemMessagePromptTemplate } from "../prompts/index.js";
import { formatToOpenAIFunction } from "../tools/convert_to_openai.js";
import { StructuredTool } from "../tools/index.js";

const prompt = `In addition to responding, you can use tools. 
You have access to the following tools.

{tools}

In order to use a tool, you can use <tool></tool> to specify the name, 
and the <tool_input></tool_input> tags to specify the parameters. 
Each parameter should be passed in as <param_name>value</param_name>, 
Where param_name is the name of the specific parameter, and value 
is the value for that parameter. 


If a tool is chosen: 
  You will get back a response in the XML format only about the tool. 
  For example, if you have a tool called 'search' that accepts a single 
  parameter 'query' that could run a google search, in order to search 
  for the weather in SF you would respond:

  <tool>search</tool><tool_input><query>weather in SF</query></tool_input>
  
else:
  You will get back a response in the normal format without xml form. 
`;

/**
 * Wrapper around Minimax large language models that use the Chat endpoint.
 *
 */

export interface ChatAnthropicFunctionsCallOptions extends FunctionCallOptions {
  tools?: StructuredTool[];
}

export class ChatAnthropicFunctions extends BaseChatModel<ChatAnthropicFunctionsCallOptions> {
  model: ChatAnthropic;

  functionEnabled: boolean;

  static lc_name() {
    return "ChatAnthropicFunctions";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      anthropicApiKey: "ANTHROPIC_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
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

    // convert tools to functions if functions not provided
    if (
      !newOptions.functions &&
      newOptions.tools &&
      newOptions.tools.length > 0
    ) {
      newOptions.functions = newOptions.tools.map(formatToOpenAIFunction);
    }

    if (newOptions.functions && newOptions.functions.length > 0) {
      this.functionEnabled = true;

      if (!newOptions.stop) {
        newOptions.stop = ["</tool_input>"];
      } else {
        newOptions.stop?.push("</tool_input>");
      }

      if (newOptions.function_call) {
        // if options.function_call is string , this.function_call = options.function_call
        // else if options.function_call is object , this.function_call = options.function_call.name
        let function_call = "auto";
        if (typeof newOptions.function_call === "string") {
          function_call = newOptions.function_call;
        } else if (typeof newOptions.function_call === "object") {
          function_call = newOptions.function_call.name;
        }

        if (function_call === "none") {
          newOptions.functions = [];
        } else if (function_call !== "auto") {
          // newOptions.functions中name!=function_call的移除
          newOptions.functions = newOptions.functions.filter(
            (item) => item.name === function_call
          );
        }
      }

      const builder = new XMLBuilder({
        arrayNodeName: "tool",
        oneListGroup: true,
      });
      const functionsXml = builder.build(newOptions.functions);

      const systemMessage = await SystemMessagePromptTemplate.fromTemplate(
        prompt
      ).format({ tools: functionsXml });
      // put to the front of the messages
      messages.unshift(systemMessage);
    } else {
      if (options.function_call) {
        throw new Error(
          "if `function_call` provided, `functions` must also be"
        );
      }
    }

    const chatResult = await this.model._generate(
      messages,
      newOptions,
      runManager
    );

    const { generations: resultGenerations } = chatResult;
    const { message } = resultGenerations[0];
    const result = `${message.content.trim()}`;
    const trimmedResult = result.trim();

    let generations = resultGenerations;

    //  Determine whether the trimmed Result contains <tool>, if yes, parse it into xml and turn it into AIMessage.
    if (this.functionEnabled && trimmedResult.includes("<tool>")) {
      const xmlParser = new XMLParser();
      const jObj = xmlParser.parse(`${trimmedResult}</tool_input>`);

      const aiMessage = new AIMessage("", {
        function_call: {
          name: jObj.tool,
          arguments: JSON.stringify(jObj.tool_input ?? {}),
        },
      });
      // clear generations and push new item
      generations = [];
      generations.push({
        text: "",
        message: aiMessage,
      });
    }

    return {
      generations,
      llmOutput: chatResult.llmOutput,
    };
  }

  _llmType() {
    return "anthropicFunction";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}

import { FunctionDefinition , BaseFunctionCallOptions } from "@langchain/core/language_models/base";
import {
  AIMessage,
  BaseMessage,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { type ChatOllamaInput } from "../../chat_models/ollama.js";

const DEFAULT_TOOL_SYSTEM_TEMPLATE = `You have access to the following tools:
{tools}
You must always select one of the above tools and respond with only a JSON object matching the following schema:
{{
  "tool": <name of the selected tool>,
  "tool_input": <parameters for the selected tool, matching the tool's JSON schema>
}}`;

export interface ChatOllamaFunctionsCallOptions
  extends BaseFunctionCallOptions {}

export type OllamaFunctionsInput = Partial<ChatOllamaInput> &
  BaseChatModelParams & {
    llm?: ChatOllama;
    toolSystemPromptTemplate?: string;
  };

export class OllamaFunctions extends BaseChatModel<ChatOllamaFunctionsCallOptions> {
  llm: ChatOllama;

  toolSystemPromptTemplate: string = DEFAULT_TOOL_SYSTEM_TEMPLATE;

  protected defaultResponseFunction = {
    name: "__conversational_response",
    description:
      "Respond conversationally if no other tools should be called for a given query.",
    parameters: {
      type: "object",
      properties: {
        response: {
          type: "string",
          description: "Conversational response to the user.",
        },
      },
      required: ["response"],
    },
  };

  lc_namespace = ["langchain", "experimental", "chat_models"];

  static lc_name(): string {
    return "OllamaFunctions";
  }

  constructor(fields?: OllamaFunctionsInput) {
    super(fields ?? {});
    this.llm = fields?.llm ?? new ChatOllama({ ...fields, format: "json" });
    this.toolSystemPromptTemplate =
      fields?.toolSystemPromptTemplate ?? this.toolSystemPromptTemplate;
  }

  invocationParams() {
    return this.llm.invocationParams();
  }

  /** @ignore */
  _identifyingParams() {
    return this.llm._identifyingParams();
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const functions = this._prepareFunctions(options);
    const systemMessage = await this._prepareSystemMessage(functions);
    yield* this.llm._streamResponseChunks(
      [systemMessage, ...messages],
      options,
      runManager
    );
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const functions = this._prepareFunctions(options);
    const systemMessage = await this._prepareSystemMessage(functions);
    const chatResult = await this.llm._generate(
      [systemMessage, ...messages],
      options,
      runManager
    );
    const chatGenerationContent = chatResult.generations[0].message.content;
    if (typeof chatGenerationContent !== "string") {
      throw new Error("OllamaFunctions does not support non-string output.");
    }
    let parsedChatResult;
    try {
      parsedChatResult = JSON.parse(chatGenerationContent);
    } catch (e) {
      throw new Error(
        `"${this.llm.model}" did not respond with valid JSON. Please try again.`
      );
    }
    const calledToolName = parsedChatResult.tool;
    const calledToolArguments = parsedChatResult.tool_input;
    const calledTool = functions.find((fn) => fn.name === calledToolName);
    if (calledTool === undefined) {
      throw new Error(
        `Failed to parse a function call from ${this.llm.model} output: ${chatGenerationContent}`
      );
    }
    if (calledTool.name === this.defaultResponseFunction.name) {
      return {
        generations: [
          {
            message: new AIMessage({
              content: calledToolArguments.response,
            }),
            text: calledToolArguments.response,
          },
        ],
      };
    }

    const responseMessageWithFunctions = new AIMessage({
      content: "",
      additional_kwargs: {
        function_call: {
          name: calledToolName,
          arguments: calledToolArguments
            ? JSON.stringify(calledToolArguments)
            : "",
        },
      },
    });

    return {
      generations: [{ message: responseMessageWithFunctions, text: "" }],
    };
  }

  _prepareFunctions(options: this["ParsedCallOptions"]): FunctionDefinition[] {
    let functions = options.functions ?? [];
    if (options.function_call !== undefined) {
      functions = functions.filter(
        (fn) => fn.name === options.function_call?.name
      );
      if (!functions.length) {
        throw new Error(
          `If "function_call" is specified, you must also pass a matching function in "functions".`
        );
      }
    } else if (functions.length === 0) {
      functions.push(this.defaultResponseFunction);
    }
    return functions;
  }

  async _prepareSystemMessage(
    functions: FunctionDefinition[]
  ): Promise<BaseMessage> {
    const systemPromptTemplate = SystemMessagePromptTemplate.fromTemplate(
      this.toolSystemPromptTemplate
    );
    const systemMessage = await systemPromptTemplate.format({
      tools: JSON.stringify(functions, null, 2),
    });
    return systemMessage;
  }

  _llmType(): string {
    return "ollama_functions";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}

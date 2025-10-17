import { XMLParser } from "fast-xml-parser";
import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  SystemMessage,
  coerceMessageLikeToMessage,
} from "@langchain/core/messages";
import type {
  ChatGenerationChunk,
  ChatResult,
  LLMResult,
} from "@langchain/core/outputs";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  CallbackManagerForLLMRun,
  Callbacks,
} from "@langchain/core/callbacks/manager";
import { BasePromptTemplate } from "@langchain/core/prompts";
import type {
  BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
  StructuredOutputMethodParams,
  StructuredOutputMethodOptions,
  ToolDefinition,
  FunctionDefinition,
} from "@langchain/core/language_models/base";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import type { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import {
  type JsonSchema7ObjectType,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import { ChatAnthropic, type AnthropicInput } from "../chat_models.js";
import {
  DEFAULT_TOOL_SYSTEM_PROMPT,
  ToolInvocation,
  formatAsXMLRepresentation,
  fixArrayXMLParameters,
} from "./utils/tool_calling.js";

export interface ChatAnthropicToolsCallOptions
  extends BaseLanguageModelCallOptions {
  tools?: ToolDefinition[];
  tool_choice?:
    | "auto"
    | {
        function: {
          name: string;
        };
        type: "function";
      };
}

export type ChatAnthropicToolsInput = Partial<AnthropicInput> &
  BaseChatModelParams & {
    llm?: BaseChatModel;
    systemPromptTemplate?: BasePromptTemplate;
  };

/**
 * Experimental wrapper over Anthropic chat models that adds support for
 * a function calling interface.
 * @deprecated Prefer traditional tool use through ChatAnthropic.
 */
export class ChatAnthropicTools extends BaseChatModel<ChatAnthropicToolsCallOptions> {
  llm: BaseChatModel;

  stopSequences?: string[];

  systemPromptTemplate: BasePromptTemplate;

  lc_namespace = ["langchain", "experimental", "chat_models"];

  static lc_name(): string {
    return "ChatAnthropicTools";
  }

  constructor(fields?: ChatAnthropicToolsInput) {
    if (fields?.cache !== undefined) {
      throw new Error("Caching is not supported for this model.");
    }
    super(fields ?? {});
    this.llm = fields?.llm ?? new ChatAnthropic(fields);
    this.systemPromptTemplate =
      fields?.systemPromptTemplate ?? DEFAULT_TOOL_SYSTEM_PROMPT;
    this.stopSequences =
      fields?.stopSequences ?? (this.llm as ChatAnthropic).stopSequences;
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
    yield* this.llm._streamResponseChunks(messages, options, runManager);
  }

  async _prepareAndParseToolCall({
    messages,
    options,
    systemPromptTemplate = DEFAULT_TOOL_SYSTEM_PROMPT,
    stopSequences,
  }: {
    messages: BaseMessage[];
    options: ChatAnthropicToolsCallOptions;
    systemPromptTemplate?: BasePromptTemplate;
    stopSequences: string[];
  }): Promise<ChatResult> {
    let promptMessages = messages;
    let forced = false;
    let toolCall: string | undefined;
    const tools = options.tools === undefined ? [] : [...options.tools];
    if (options.tools !== undefined && options.tools.length > 0) {
      const content = await systemPromptTemplate.format({
        tools: `<tools>\n${options.tools
          .map(formatAsXMLRepresentation)
          .join("\n\n")}</tools>`,
      });
      if (promptMessages.length && promptMessages[0]._getType() !== "system") {
        const systemMessage = new SystemMessage({ content });
        promptMessages = [systemMessage].concat(promptMessages);
      } else {
        const systemMessage = new SystemMessage({
          content: `${content}\n\n${promptMessages[0].content}`,
        });
        promptMessages = [systemMessage].concat(promptMessages.slice(1));
      }
      // eslint-disable-next-line no-param-reassign
      options.stop = stopSequences.concat(["</function_calls>"]);
      if (options.tool_choice && options.tool_choice !== "auto") {
        toolCall = options.tool_choice.function.name;
        forced = true;
        const matchingFunction = options.tools.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tool) => tool.function.name === toolCall
        );
        if (!matchingFunction) {
          throw new Error(
            `No matching function found for passed "tool_choice"`
          );
        }
        promptMessages = promptMessages.concat([
          new AIMessage({
            content: `<function_calls>\n<invoke><tool_name>${toolCall}</tool_name>`,
          }),
        ]);
        // eslint-disable-next-line no-param-reassign
        delete options.tool_choice;
      }
      // eslint-disable-next-line no-param-reassign
      delete options.tools;
    } else if (options.tool_choice !== undefined) {
      throw new Error(`If "tool_choice" is provided, "tools" must also be.`);
    }
    const chatResult = await this.llm
      .withConfig({ runName: "ChatAnthropicTools" })
      .invoke(promptMessages, options);
    const chatGenerationContent = chatResult.content;
    if (typeof chatGenerationContent !== "string") {
      throw new Error("AnthropicFunctions does not support non-string output.");
    }

    if (forced) {
      const parser = new XMLParser();
      const result = parser.parse(
        `<function_calls>\n<invoke><tool_name>${toolCall}</tool_name>${chatGenerationContent}</function_calls>`
      );
      if (toolCall === undefined) {
        throw new Error(`Could not parse called function from model output.`);
      }
      const invocations: ToolInvocation[] = Array.isArray(
        result.function_calls?.invoke ?? []
      )
        ? result.function_calls.invoke
        : [result.function_calls.invoke];
      const responseMessageWithFunctions = new AIMessage({
        content: "",
        additional_kwargs: {
          tool_calls: invocations.map((toolInvocation, i) => {
            const calledTool = tools.find(
              (tool) => tool.function.name === toolCall
            );
            if (calledTool === undefined) {
              throw new Error(
                `Called tool "${toolCall}" did not match an existing tool.`
              );
            }
            return {
              id: i.toString(),
              type: "function",
              function: {
                name: toolInvocation.tool_name,
                arguments: JSON.stringify(
                  fixArrayXMLParameters(
                    calledTool.function.parameters as JsonSchema7ObjectType,
                    toolInvocation.parameters
                  )
                ),
              },
            };
          }),
        },
      });
      return {
        generations: [{ message: responseMessageWithFunctions, text: "" }],
      };
    } else if (chatGenerationContent.includes("<function_calls>")) {
      const parser = new XMLParser();
      const result = parser.parse(`${chatGenerationContent}</function_calls>`);
      const invocations: ToolInvocation[] = Array.isArray(
        result.function_calls?.invoke ?? []
      )
        ? result.function_calls.invoke
        : [result.function_calls.invoke];
      const responseMessageWithFunctions = new AIMessage({
        content: chatGenerationContent.split("<function_calls>")[0],
        additional_kwargs: {
          tool_calls: invocations.map((toolInvocation, i) => {
            const calledTool = tools.find(
              (tool) => tool.function.name === toolInvocation.tool_name
            );
            if (calledTool === undefined) {
              throw new Error(
                `Called tool "${toolCall}" did not match an existing tool.`
              );
            }
            return {
              id: i.toString(),
              type: "function",
              function: {
                name: toolInvocation.tool_name,
                arguments: JSON.stringify(
                  fixArrayXMLParameters(
                    calledTool.function.parameters as JsonSchema7ObjectType,
                    toolInvocation.parameters
                  )
                ),
              },
            };
          }),
        },
      });
      return {
        generations: [{ message: responseMessageWithFunctions, text: "" }],
      };
    }
    return { generations: [{ message: chatResult, text: "" }] };
  }

  async generate(
    messages: BaseMessageLike[][],
    parsedOptions?: ChatAnthropicToolsCallOptions,
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    // generate results
    const chatResults = await Promise.all(
      baseMessages.map((messageList) =>
        this._prepareAndParseToolCall({
          messages: messageList,
          options: { callbacks, ...parsedOptions },
          systemPromptTemplate: this.systemPromptTemplate,
          stopSequences: this.stopSequences ?? [],
        })
      )
    );
    // create combined output
    const output: LLMResult = {
      generations: chatResults.map((chatResult) => chatResult.generations),
    };
    return output;
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    throw new Error("Unused.");
  }

  _llmType(): string {
    return "anthropic_tool_calling";
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | StructuredOutputMethodParams<RunOutput, false>
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false> & { force?: boolean }
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | StructuredOutputMethodParams<RunOutput, true>
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true> & { force?: boolean }
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | StructuredOutputMethodParams<RunOutput, boolean>
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean> & { force?: boolean }
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: InteropZodType<RunOutput> | Record<string, any>;
    let name;
    let method;
    let includeRaw;
    let force;
    if (isStructuredOutputMethodParams(outputSchema)) {
      schema = outputSchema.schema;
      name = outputSchema.name;
      method = outputSchema.method;
      includeRaw = outputSchema.includeRaw;
    } else {
      schema = outputSchema;
      name = config?.name;
      method = config?.method;
      includeRaw = config?.includeRaw;
      force = config?.force ?? false;
    }
    if (method === "jsonMode") {
      throw new Error(`Anthropic only supports "functionCalling" as a method.`);
    }

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let tools: ToolDefinition[];
    if (isInteropZodSchema(schema)) {
      const jsonSchema = toJsonSchema(schema);
      tools = [
        {
          type: "function" as const,
          function: {
            name: functionName,
            description: jsonSchema.description,
            parameters: jsonSchema,
          },
        },
      ];
      outputParser = new JsonOutputKeyToolsParser({
        returnSingle: true,
        keyName: functionName,
        zodSchema: schema,
      });
    } else {
      let openAIFunctionDefinition: FunctionDefinition;
      if (
        typeof schema.name === "string" &&
        typeof schema.parameters === "object" &&
        schema.parameters != null
      ) {
        openAIFunctionDefinition = schema as FunctionDefinition;
        functionName = schema.name;
      } else {
        openAIFunctionDefinition = {
          name: functionName,
          description: schema.description ?? "",
          parameters: schema,
        };
      }
      tools = [
        {
          type: "function" as const,
          function: openAIFunctionDefinition,
        },
      ];
      outputParser = new JsonOutputKeyToolsParser<RunOutput>({
        returnSingle: true,
        keyName: functionName,
      });
    }
    const llm = this.withConfig({
      tools,
      tool_choice: force
        ? {
            type: "function",
            function: {
              name: functionName,
            },
          }
        : "auto",
    });

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatAnthropicStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }
}

function isStructuredOutputMethodParams(
  x: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): x is StructuredOutputMethodParams<Record<string, any>> {
  return (
    x !== undefined &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (x as StructuredOutputMethodParams<Record<string, any>>).schema ===
      "object"
  );
}

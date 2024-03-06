import { XMLParser } from "fast-xml-parser";
import {
  AIMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BasePromptTemplate } from "@langchain/core/prompts";
import {
  BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
  StructuredOutputMethodParams,
  StructuredOutputMethodOptions,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { JsonSchema7ObjectType, zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
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
    runManager,
    systemPromptTemplate = DEFAULT_TOOL_SYSTEM_PROMPT,
    stopSequences,
  }: {
    messages: BaseMessage[];
    options: ChatAnthropicToolsCallOptions;
    runManager?: CallbackManagerForLLMRun;
    systemPromptTemplate?: BasePromptTemplate;
    stopSequences: string[];
  }) {
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
    const chatResult = await this.llm._generate(
      promptMessages,
      options,
      runManager
    );
    const chatGenerationContent = chatResult.generations[0].message.content;
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
    return chatResult;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    return this._prepareAndParseToolCall({
      messages,
      options,
      systemPromptTemplate: this.systemPromptTemplate,
      stopSequences: this.stopSequences ?? [],
    });
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
      | z.ZodType<RunOutput>
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | StructuredOutputMethodParams<RunOutput, true>
      | z.ZodType<RunOutput>
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | StructuredOutputMethodParams<RunOutput, boolean>
      | z.ZodType<RunOutput>
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: z.ZodType<RunOutput> | Record<string, any>;
    let name;
    let method;
    let includeRaw;
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
    }
    if (method === "jsonMode") {
      throw new Error(`Anthropic only supports "functionCalling" as a method.`);
    }

    const functionName = name ?? "extract";
    const outputParser = new JsonOutputKeyToolsParser<RunOutput>({
      returnSingle: true,
      keyName: functionName,
    });
    let tools: ToolDefinition[];
    if (isZodSchema(schema)) {
      const jsonSchema = zodToJsonSchema(schema);
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
    } else {
      tools = [
        {
          type: "function" as const,
          function: {
            name: functionName,
            description: schema.description,
            parameters: schema,
          },
        },
      ];
    }
    const llm = this.bind({
      tools,
      tool_choice: {
        type: "function",
        function: {
          name: functionName,
        },
      },
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

function isZodSchema<
  // prettier-ignore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
>(input: any): input is z.ZodType<RunOutput, z.ZodTypeDef, RunOutput> {
  // Check for a characteristic method of Zod schemas
  return typeof input?.parse === "function";
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

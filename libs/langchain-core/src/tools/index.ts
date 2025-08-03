import { z } from "zod/v3";
import {
  validate,
  type Schema as ValidationSchema,
} from "@cfworker/json-schema";
import {
  CallbackManager,
  CallbackManagerForToolRun,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { BaseLangChain } from "../language_models/base.js";
import {
  mergeConfigs,
  ensureConfig,
  patchConfig,
  pickRunnableConfigKeys,
  type RunnableConfig,
} from "../runnables/config.js";
import type { RunnableFunc } from "../runnables/base.js";
import { isDirectToolOutput, ToolCall, ToolMessage } from "../messages/tool.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import {
  _configHasToolCallId,
  _isToolCall,
  ToolInputParsingException,
} from "./utils.js";
import {
  type InferInteropZodInput,
  type InferInteropZodOutput,
  type InteropZodObject,
  type InteropZodType,
  interopParseAsync,
  isSimpleStringZodSchema,
  isInteropZodSchema,
  type ZodStringV3,
  type ZodStringV4,
  type ZodObjectV3,
  type ZodObjectV4,
} from "../utils/types/zod.js";
import type {
  StructuredToolCallInput,
  ToolInputSchemaBase,
  ToolReturnType,
  ResponseFormat,
  ToolInputSchemaInputType,
  ToolInputSchemaOutputType,
  ToolParams,
  ToolRunnableConfig,
  StructuredToolInterface,
  DynamicToolInput,
  DynamicStructuredToolInput,
  StringInputToolSchema,
  ToolInterface,
  ToolOutputType,
} from "./types.js";
import { type JSONSchema, validatesOnlyStrings } from "../utils/json_schema.js";

export type {
  BaseDynamicToolInput,
  ContentAndArtifact,
  DynamicToolInput,
  DynamicStructuredToolInput,
  ResponseFormat,
  StructuredToolCallInput,
  StructuredToolInterface,
  StructuredToolParams,
  ToolInterface,
  ToolParams,
  ToolReturnType,
  ToolRunnableConfig,
  ToolInputSchemaBase as ToolSchemaBase,
} from "./types.js";

export {
  isLangChainTool,
  isRunnableToolLike,
  isStructuredTool,
  isStructuredToolParams,
} from "./types.js";

export { ToolInputParsingException };
/**
 * Base class for Tools that accept input of any shape defined by a Zod schema.
 */
export abstract class StructuredTool<
    SchemaT = ToolInputSchemaBase,
    SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
    SchemaInputT = ToolInputSchemaInputType<SchemaT>,
    ToolOutputT = ToolOutputType
  >
  extends BaseLangChain<
    StructuredToolCallInput<SchemaT, SchemaInputT>,
    ToolOutputT | ToolMessage
  >
  implements StructuredToolInterface<SchemaT, SchemaInputT, ToolOutputT>
{
  abstract name: string;

  abstract description: string;

  abstract schema: SchemaT;

  /**
   * Whether to return the tool's output directly.
   *
   * Setting this to true means that after the tool is called,
   * an agent should stop looping.
   */
  returnDirect = false;

  verboseParsingErrors = false;

  get lc_namespace() {
    return ["langchain", "tools"];
  }

  /**
   * The tool response format.
   *
   * If "content" then the output of the tool is interpreted as the contents of a
   * ToolMessage. If "content_and_artifact" then the output is expected to be a
   * two-tuple corresponding to the (content, artifact) of a ToolMessage.
   *
   * @default "content"
   */
  responseFormat?: ResponseFormat = "content";

  /**
   * Default config object for the tool runnable.
   */
  defaultConfig?: ToolRunnableConfig;

  constructor(fields?: ToolParams) {
    super(fields ?? {});

    this.verboseParsingErrors =
      fields?.verboseParsingErrors ?? this.verboseParsingErrors;
    this.responseFormat = fields?.responseFormat ?? this.responseFormat;
    this.defaultConfig = fields?.defaultConfig ?? this.defaultConfig;
  }

  protected abstract _call(
    arg: SchemaOutputT,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig
  ): Promise<ToolOutputT>;

  /**
   * Invokes the tool with the provided input and configuration.
   * @param input The input for the tool.
   * @param config Optional configuration for the tool.
   * @returns A Promise that resolves with the tool's output.
   */
  async invoke<
    TInput extends StructuredToolCallInput<SchemaT, SchemaInputT>,
    TConfig extends ToolRunnableConfig | undefined
  >(
    input: TInput,
    config?: TConfig
  ): Promise<ToolReturnType<TInput, TConfig, ToolOutputT>> {
    let toolInput: Exclude<
      StructuredToolCallInput<SchemaT, SchemaInputT>,
      ToolCall
    >;

    let enrichedConfig: ToolRunnableConfig = ensureConfig(
      mergeConfigs(this.defaultConfig, config)
    );
    if (_isToolCall(input)) {
      toolInput = input.args as Exclude<
        StructuredToolCallInput<SchemaT, SchemaInputT>,
        ToolCall
      >;
      enrichedConfig = {
        ...enrichedConfig,
        toolCall: input,
      };
    } else {
      toolInput = input as Exclude<
        StructuredToolCallInput<SchemaT, SchemaInputT>,
        ToolCall
      >;
    }

    return this.call(toolInput, enrichedConfig) as Promise<
      ToolReturnType<TInput, TConfig, ToolOutputT>
    >;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   *
   * Calls the tool with the provided argument, configuration, and tags. It
   * parses the input according to the schema, handles any errors, and
   * manages callbacks.
   * @param arg The input argument for the tool.
   * @param configArg Optional configuration or callbacks for the tool.
   * @param tags Optional tags for the tool.
   * @returns A Promise that resolves with a string.
   */
  async call<
    TArg extends StructuredToolCallInput<SchemaT, SchemaInputT>,
    TConfig extends ToolRunnableConfig | undefined
  >(
    arg: TArg,
    configArg?: TConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<ToolReturnType<TArg, TConfig, ToolOutputT>> {
    // Determine the actual input that needs parsing/validation.
    // If arg is a ToolCall, use its args; otherwise, use arg directly.
    const inputForValidation = _isToolCall(arg) ? arg.args : arg;

    let parsed: SchemaOutputT; // This will hold the successfully parsed input of the expected output type.
    if (isInteropZodSchema(this.schema)) {
      try {
        // Validate the inputForValidation - TS needs help here as it can't exclude ToolCall based on the check
        parsed = await interopParseAsync(
          this.schema as InteropZodType,
          inputForValidation as Exclude<TArg, ToolCall>
        );
      } catch (e) {
        let message = `Received tool input did not match expected schema`;
        if (this.verboseParsingErrors) {
          message = `${message}\nDetails: ${(e as Error).message}`;
        }
        // Pass the original raw input arg to the exception
        throw new ToolInputParsingException(message, JSON.stringify(arg));
      }
    } else {
      const result = validate(
        inputForValidation,
        this.schema as ValidationSchema
      );
      if (!result.valid) {
        let message = `Received tool input did not match expected schema`;
        if (this.verboseParsingErrors) {
          message = `${message}\nDetails: ${result.errors
            .map((e) => `${e.keywordLocation}: ${e.error}`)
            .join("\n")}`;
        }
        // Pass the original raw input arg to the exception
        throw new ToolInputParsingException(message, JSON.stringify(arg));
      }
      // Assign the validated input to parsed
      // We cast here because validate() doesn't narrow the type sufficiently for TS, but we know it's valid.
      parsed = inputForValidation as SchemaOutputT;
    }

    const config = parseCallbackConfigArg(configArg);
    const callbackManager_ = CallbackManager.configure(
      config.callbacks,
      this.callbacks,
      config.tags || tags,
      this.tags,
      config.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleToolStart(
      this.toJSON(),
      // Log the original raw input arg
      typeof arg === "string" ? arg : JSON.stringify(arg),
      config.runId,
      undefined,
      undefined,
      undefined,
      config.runName
    );
    delete config.runId;
    let result;
    try {
      // Pass the correctly typed parsed input to _call
      result = await this._call(parsed, runManager, config);
    } catch (e) {
      await runManager?.handleToolError(e);
      throw e;
    }
    let content;
    let artifact;
    if (this.responseFormat === "content_and_artifact") {
      if (Array.isArray(result) && result.length === 2) {
        [content, artifact] = result;
      } else {
        throw new Error(
          `Tool response format is "content_and_artifact" but the output was not a two-tuple.\nResult: ${JSON.stringify(
            result
          )}`
        );
      }
    } else {
      content = result;
    }

    let toolCallId: string | undefined;
    // Extract toolCallId ONLY if the original arg was a ToolCall
    if (_isToolCall(arg)) {
      toolCallId = arg.id;
    }
    // Or if it was provided in the config's toolCall property
    if (!toolCallId && _configHasToolCallId(config)) {
      toolCallId = config.toolCall.id;
    }

    const formattedOutput = _formatToolOutput<ToolOutputT>({
      content,
      artifact,
      toolCallId,
      name: this.name,
    });
    await runManager?.handleToolEnd(formattedOutput);
    return formattedOutput as ToolReturnType<TArg, TConfig, ToolOutputT>;
  }
}

/**
 * Base class for Tools that accept input as a string.
 */
export abstract class Tool<ToolOutputT = ToolOutputType>
  extends StructuredTool<
    StringInputToolSchema,
    ToolInputSchemaOutputType<StringInputToolSchema>,
    ToolInputSchemaInputType<StringInputToolSchema>,
    ToolOutputT
  >
  implements
    ToolInterface<
      StringInputToolSchema,
      ToolInputSchemaInputType<StringInputToolSchema>,
      ToolOutputT
    >
{
  schema = z
    .object({ input: z.string().optional() })
    .transform((obj) => obj.input);

  constructor(fields?: ToolParams) {
    super(fields);
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   *
   * Calls the tool with the provided argument and callbacks. It handles
   * string inputs specifically.
   * @param arg The input argument for the tool, which can be a string, undefined, or an input of the tool's schema.
   * @param callbacks Optional callbacks for the tool.
   * @returns A Promise that resolves with a string.
   */
  // Match the base class signature including the generics and conditional return type
  call<
    TArg extends string | undefined | z.input<this["schema"]> | ToolCall,
    TConfig extends ToolRunnableConfig | undefined
  >(
    arg: TArg,
    callbacks?: TConfig
  ): Promise<ToolReturnType<NonNullable<TArg>, TConfig, ToolOutputT>> {
    // Prepare the input for the base class call method.
    // If arg is string or undefined, wrap it; otherwise, pass ToolCall or { input: ... } directly.
    const structuredArg =
      typeof arg === "string" || arg == null ? { input: arg } : arg;

    // Ensure TConfig is passed to super.call
    return super.call(structuredArg, callbacks);
  }
}

/**
 * A tool that can be created dynamically from a function, name, and description.
 */
export class DynamicTool<
  ToolOutputT = ToolOutputType
> extends Tool<ToolOutputT> {
  static lc_name() {
    return "DynamicTool";
  }

  name: string;

  description: string;

  func: DynamicToolInput<ToolOutputT>["func"];

  constructor(fields: DynamicToolInput<ToolOutputT>) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   */
  async call<
    TArg extends string | undefined | z.input<this["schema"]> | ToolCall,
    TConfig extends ToolRunnableConfig | undefined
  >(
    arg: TArg,
    configArg?: TConfig
  ): Promise<ToolReturnType<NonNullable<TArg>, TConfig, ToolOutputT>> {
    const config = parseCallbackConfigArg(configArg);
    if (config.runName === undefined) {
      config.runName = this.name;
    }
    // Call the Tool class's call method, passing generics through
    // Cast config to TConfig to satisfy the super.call signature
    return super.call<TArg, TConfig>(arg, config as TConfig);
  }

  /** @ignore */
  async _call(
    input: string, // DynamicTool's _call specifically expects a string after schema transformation
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig
  ): Promise<ToolOutputT> {
    return this.func(input, runManager, parentConfig);
  }
}

/**
 * A tool that can be created dynamically from a function, name, and
 * description, designed to work with structured data. It extends the
 * StructuredTool class and overrides the _call method to execute the
 * provided function when the tool is called.
 *
 * Schema can be passed as Zod or JSON schema. The tool will not validate
 * input if JSON schema is passed.
 */
export class DynamicStructuredTool<
  SchemaT = ToolInputSchemaBase,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>,
  ToolOutputT = ToolOutputType
> extends StructuredTool<SchemaT, SchemaOutputT, SchemaInputT, ToolOutputT> {
  static lc_name() {
    return "DynamicStructuredTool";
  }

  name: string;

  description: string;

  func: DynamicStructuredToolInput<SchemaT, SchemaOutputT, ToolOutputT>["func"];

  schema: SchemaT;

  constructor(
    fields: DynamicStructuredToolInput<SchemaT, SchemaOutputT, ToolOutputT>
  ) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
    this.schema = fields.schema;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   */
  // Match the base class signature
  async call<
    TArg extends StructuredToolCallInput<SchemaT, SchemaInputT>,
    TConfig extends ToolRunnableConfig | undefined
  >(
    arg: TArg,
    configArg?: TConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<ToolReturnType<NonNullable<TArg>, TConfig, ToolOutputT>> {
    const config = parseCallbackConfigArg(configArg);
    if (config.runName === undefined) {
      config.runName = this.name;
    }

    // Call the base class method, passing generics through
    // Cast config to TConfig to satisfy the super.call signature
    return super.call<TArg, TConfig>(arg, config as TConfig, tags);
  }

  protected _call(
    arg: Parameters<
      DynamicStructuredToolInput<SchemaT, SchemaOutputT>["func"]
    >[0],
    runManager?: CallbackManagerForToolRun,
    parentConfig?: RunnableConfig
  ): Promise<ToolOutputT> {
    return this.func(arg, runManager, parentConfig);
  }
}

/**
 * Abstract base class for toolkits in LangChain. Toolkits are collections
 * of tools that agents can use. Subclasses must implement the `tools`
 * property to provide the specific tools for the toolkit.
 */
export abstract class BaseToolkit {
  abstract tools: StructuredToolInterface[];

  getTools(): StructuredToolInterface[] {
    return this.tools;
  }
}

/**
 * Parameters for the tool function.
 * Schema can be provided as Zod or JSON schema.
 * Both schema types will be validated.
 * @template {ToolInputSchemaBase} RunInput The input schema for the tool.
 */
interface ToolWrapperParams<RunInput = ToolInputSchemaBase | undefined>
  extends ToolParams {
  /**
   * The name of the tool. If using with an LLM, this
   * will be passed as the tool name.
   */
  name: string;
  /**
   * The description of the tool.
   * @default `${fields.name} tool`
   */
  description?: string;
  /**
   * The input schema for the tool. If using an LLM, this
   * will be passed as the tool schema to generate arguments
   * for.
   */
  schema?: RunInput;
  /**
   * The tool response format.
   *
   * If "content" then the output of the tool is interpreted as the contents of a
   * ToolMessage. If "content_and_artifact" then the output is expected to be a
   * two-tuple corresponding to the (content, artifact) of a ToolMessage.
   *
   * @default "content"
   */
  responseFormat?: ResponseFormat;
  /**
   * Whether to return the tool's output directly.
   *
   * Setting this to true means that after the tool is called,
   * an agent should stop looping.
   */
  returnDirect?: boolean;
}

/**
 * Creates a new StructuredTool instance with the provided function, name, description, and schema.
 *
 * Schema can be provided as Zod or JSON schema, and both will be validated.
 *
 * @function
 * @template {ToolInputSchemaBase} SchemaT The input schema for the tool.
 * @template {ToolReturnType} ToolOutputT The output type of the tool.
 *
 * @param {RunnableFunc<z.output<SchemaT>, ToolOutputT>} func - The function to invoke when the tool is called.
 * @param {ToolWrapperParams<SchemaT>} fields - An object containing the following properties:
 * @param {string} fields.name The name of the tool.
 * @param {string | undefined} fields.description The description of the tool. Defaults to either the description on the Zod schema, or `${fields.name} tool`.
 * @param {z.AnyZodObject | z.ZodString | undefined} fields.schema The Zod schema defining the input for the tool. If undefined, it will default to a Zod string schema.
 *
 * @returns {DynamicStructuredTool<SchemaT>} A new StructuredTool instance.
 */
export function tool<SchemaT extends ZodStringV3, ToolOutputT = ToolOutputType>(
  func: RunnableFunc<
    InferInteropZodOutput<SchemaT>,
    ToolOutputT,
    ToolRunnableConfig
  >,
  fields: ToolWrapperParams<SchemaT>
): DynamicTool<ToolOutputT>;

export function tool<SchemaT extends ZodStringV4, ToolOutputT = ToolOutputType>(
  func: RunnableFunc<
    InferInteropZodOutput<SchemaT>,
    ToolOutputT,
    ToolRunnableConfig
  >,
  fields: ToolWrapperParams<SchemaT>
): DynamicTool<ToolOutputT>;

export function tool<
  SchemaT extends ZodObjectV3,
  SchemaOutputT = InferInteropZodOutput<SchemaT>,
  SchemaInputT = InferInteropZodInput<SchemaT>,
  ToolOutputT = ToolOutputType
>(
  func: RunnableFunc<SchemaOutputT, ToolOutputT, ToolRunnableConfig>,
  fields: ToolWrapperParams<SchemaT>
): DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT, ToolOutputT>;

export function tool<
  SchemaT extends ZodObjectV4,
  SchemaOutputT = InferInteropZodOutput<SchemaT>,
  SchemaInputT = InferInteropZodInput<SchemaT>,
  ToolOutputT = ToolOutputType
>(
  func: RunnableFunc<SchemaOutputT, ToolOutputT, ToolRunnableConfig>,
  fields: ToolWrapperParams<SchemaT>
): DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT, ToolOutputT>;

export function tool<
  SchemaT extends JSONSchema,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>,
  ToolOutputT = ToolOutputType
>(
  func: RunnableFunc<
    Parameters<DynamicStructuredToolInput<SchemaT>["func"]>[0],
    ToolOutputT,
    ToolRunnableConfig
  >,
  fields: ToolWrapperParams<SchemaT>
): DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT, ToolOutputT>;

export function tool<
  SchemaT extends
    | InteropZodObject
    | InteropZodType<string>
    | JSONSchema = InteropZodObject,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>,
  ToolOutputT = ToolOutputType
>(
  func: RunnableFunc<SchemaOutputT, ToolOutputT, ToolRunnableConfig>,
  fields: ToolWrapperParams<SchemaT>
):
  | DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT, ToolOutputT>
  | DynamicTool<ToolOutputT> {
  const isSimpleStringSchema = isSimpleStringZodSchema(fields.schema);
  const isStringJSONSchema = validatesOnlyStrings(fields.schema);

  // If the schema is not provided, or it's a simple string schema, create a DynamicTool
  if (!fields.schema || isSimpleStringSchema || isStringJSONSchema) {
    return new DynamicTool<ToolOutputT>({
      ...fields,
      description:
        fields.description ??
        (fields.schema as { description?: string } | undefined)?.description ??
        `${fields.name} tool`,
      func: async (input, runManager, config) => {
        return new Promise<ToolOutputT>((resolve, reject) => {
          const childConfig = patchConfig(config, {
            callbacks: runManager?.getChild(),
          });
          void AsyncLocalStorageProviderSingleton.runWithConfig(
            pickRunnableConfigKeys(childConfig),
            async () => {
              try {
                // TS doesn't restrict the type here based on the guard above
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                resolve(func(input as any, childConfig));
              } catch (e) {
                reject(e);
              }
            }
          );
        });
      },
    });
  }

  const schema = fields.schema as InteropZodObject | JSONSchema;

  const description =
    fields.description ??
    (fields.schema as { description?: string }).description ??
    `${fields.name} tool`;

  return new DynamicStructuredTool<
    typeof schema,
    SchemaOutputT,
    SchemaInputT,
    ToolOutputT
  >({
    ...fields,
    description,
    schema,
    func: async (input, runManager, config) => {
      return new Promise<ToolOutputT>((resolve, reject) => {
        const childConfig = patchConfig(config, {
          callbacks: runManager?.getChild(),
        });
        void AsyncLocalStorageProviderSingleton.runWithConfig(
          pickRunnableConfigKeys(childConfig),
          async () => {
            try {
              resolve(func(input, childConfig));
            } catch (e) {
              reject(e);
            }
          }
        );
      });
    },
  }) as DynamicStructuredTool<
    SchemaT,
    SchemaOutputT,
    SchemaInputT,
    ToolOutputT
  >;
}

function _formatToolOutput<TOutput extends ToolOutputType>(params: {
  content: TOutput;
  name: string;
  artifact?: unknown;
  toolCallId?: string;
}): ToolMessage | TOutput {
  const { content, artifact, toolCallId } = params;
  if (toolCallId && !isDirectToolOutput(content)) {
    if (
      typeof content === "string" ||
      (Array.isArray(content) &&
        content.every((item) => typeof item === "object"))
    ) {
      return new ToolMessage({
        content,
        artifact,
        tool_call_id: toolCallId,
        name: params.name,
      });
    } else {
      return new ToolMessage({
        content: _stringify(content),
        artifact,
        tool_call_id: toolCallId,
        name: params.name,
      });
    }
  } else {
    return content;
  }
}

function _stringify(content: unknown): string {
  try {
    return JSON.stringify(content, null, 2) ?? "";
  } catch (_noOp) {
    return `${content}`;
  }
}

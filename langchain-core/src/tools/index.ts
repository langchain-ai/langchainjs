import { z } from "zod";
import {
  validate,
  type Schema as ValidationSchema,
} from "@cfworker/json-schema";
import {
  CallbackManager,
  CallbackManagerForToolRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { BaseLangChain } from "../language_models/base.js";
import {
  ensureConfig,
  patchConfig,
  pickRunnableConfigKeys,
  type RunnableConfig,
} from "../runnables/config.js";
import type { RunnableFunc } from "../runnables/base.js";
import { isDirectToolOutput, ToolCall, ToolMessage } from "../messages/tool.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import { _isToolCall, ToolInputParsingException } from "./utils.js";
import { isZodSchema } from "../utils/types/is_zod_schema.js";
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
  ZodObjectAny,
} from "./types.js";
import { type JSONSchema, validatesOnlyStrings } from "../utils/json_schema.js";

export type {
  BaseDynamicToolInput,
  ContentAndArtifact,
  DynamicToolInput,
  DynamicStructuredToolInput,
  isLangChainTool,
  isRunnableToolLike,
  isStructuredTool,
  isStructuredToolParams,
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

export { ToolInputParsingException };
/**
 * Base class for Tools that accept input of any shape defined by a Zod schema.
 */
export abstract class StructuredTool<
  SchemaT extends ToolInputSchemaBase = ZodObjectAny,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>
> extends BaseLangChain<
  StructuredToolCallInput<SchemaT, SchemaInputT>,
  ToolReturnType
> {
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

  constructor(fields?: ToolParams) {
    super(fields ?? {});

    this.verboseParsingErrors =
      fields?.verboseParsingErrors ?? this.verboseParsingErrors;
    this.responseFormat = fields?.responseFormat ?? this.responseFormat;
  }

  protected abstract _call(
    arg: SchemaOutputT,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig
  ): Promise<ToolReturnType>;

  /**
   * Invokes the tool with the provided input and configuration.
   * @param input The input for the tool.
   * @param config Optional configuration for the tool.
   * @returns A Promise that resolves with a string.
   */
  async invoke(
    input: StructuredToolCallInput<SchemaT, SchemaInputT>,
    config?: RunnableConfig
  ): Promise<ToolReturnType> {
    let tool_call_id: string | undefined;
    let toolInput: Exclude<
      StructuredToolCallInput<SchemaT, SchemaInputT>,
      ToolCall
    >;

    let enrichedConfig: ToolRunnableConfig = ensureConfig(config);
    if (_isToolCall(input)) {
      tool_call_id = input.id;
      toolInput = input.args as Exclude<
        StructuredToolCallInput<SchemaT, SchemaInputT>,
        ToolCall
      >;
      enrichedConfig = {
        ...enrichedConfig,
        toolCall: input,
        configurable: {
          ...enrichedConfig.configurable,
          tool_call_id,
        },
      };
    } else {
      toolInput = input as Exclude<
        StructuredToolCallInput<SchemaT, SchemaInputT>,
        ToolCall
      >;
    }

    return this.call(toolInput, enrichedConfig);
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
  async call(
    arg: StructuredToolCallInput<SchemaT, SchemaInputT>,
    configArg?: Callbacks | ToolRunnableConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<ToolReturnType> {
    let parsed = arg;
    if (isZodSchema(this.schema)) {
      try {
        parsed = await (this.schema as z.ZodSchema).parseAsync(arg);
      } catch (e) {
        let message = `Received tool input did not match expected schema`;
        if (this.verboseParsingErrors) {
          message = `${message}\nDetails: ${(e as Error).message}`;
        }
        throw new ToolInputParsingException(message, JSON.stringify(arg));
      }
    } else {
      const result = validate(arg, this.schema as ValidationSchema);
      if (!result.valid) {
        let message = `Received tool input did not match expected schema`;
        if (this.verboseParsingErrors) {
          message = `${message}\nDetails: ${result.errors
            .map((e) => `${e.keywordLocation}: ${e.error}`)
            .join("\n")}`;
        }
        throw new ToolInputParsingException(message, JSON.stringify(arg));
      }
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
      typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      config.runId,
      undefined,
      undefined,
      undefined,
      config.runName
    );
    delete config.runId;
    let result;
    try {
      result = await this._call(parsed as SchemaOutputT, runManager, config);
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
    if (config && "configurable" in config) {
      toolCallId = (config.configurable as Record<string, string | undefined>)
        .tool_call_id;
    }
    const formattedOutput = _formatToolOutput({
      content,
      artifact,
      toolCallId,
      name: this.name,
    });
    await runManager?.handleToolEnd(formattedOutput);
    return formattedOutput;
  }
}

/**
 * Base class for Tools that accept input as a string.
 */
export abstract class Tool extends StructuredTool<
  z.ZodEffects<
    z.ZodObject<
      { input: z.ZodOptional<z.ZodString> },
      "strip",
      z.ZodTypeAny,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
> {
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
  call(
    arg: string | undefined | z.input<this["schema"]> | ToolCall,
    callbacks?: Callbacks | RunnableConfig
  ): Promise<ToolReturnType> {
    return super.call(
      typeof arg === "string" || !arg ? { input: arg } : arg,
      callbacks
    );
  }
}

/**
 * A tool that can be created dynamically from a function, name, and description.
 */
export class DynamicTool extends Tool {
  static lc_name() {
    return "DynamicTool";
  }

  name: string;

  description: string;

  func: DynamicToolInput["func"];

  constructor(fields: DynamicToolInput) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   */
  async call(
    arg: string | undefined | z.input<this["schema"]> | ToolCall,
    configArg?: ToolRunnableConfig | Callbacks
  ): Promise<ToolReturnType> {
    const config = parseCallbackConfigArg(configArg);
    if (config.runName === undefined) {
      config.runName = this.name;
    }
    return super.call(arg, config);
  }

  /** @ignore */
  async _call(
    input: string,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig
  ): Promise<ToolReturnType> {
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
  SchemaT extends ToolInputSchemaBase = ZodObjectAny,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>
> extends StructuredTool<SchemaT, SchemaOutputT, SchemaInputT> {
  static lc_name() {
    return "DynamicStructuredTool";
  }

  name: string;

  description: string;

  func: DynamicStructuredToolInput<SchemaT, SchemaOutputT>["func"];

  schema: SchemaT;

  constructor(fields: DynamicStructuredToolInput<SchemaT, SchemaOutputT>) {
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
  async call(
    arg: StructuredToolCallInput<SchemaT, SchemaInputT>,
    configArg?: RunnableConfig | Callbacks,
    /** @deprecated */
    tags?: string[]
  ): Promise<ToolReturnType> {
    const config = parseCallbackConfigArg(configArg);
    if (config.runName === undefined) {
      config.runName = this.name;
    }

    return super.call(arg, config, tags);
  }

  protected _call(
    arg: Parameters<
      DynamicStructuredToolInput<SchemaT, SchemaOutputT>["func"]
    >[0],
    runManager?: CallbackManagerForToolRun,
    parentConfig?: RunnableConfig
  ): Promise<ToolReturnType> {
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
 * @template {ZodObjectAny | z.ZodString | JSONSchema = ZodObjectAny} RunInput The input schema for the tool. Either any Zod object, a Zod string, or JSON schema.
 */
interface ToolWrapperParams<
  RunInput extends ZodObjectAny | z.ZodString | JSONSchema = ZodObjectAny
> extends ToolParams {
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
 * @template {ZodObjectAny | z.ZodString | JSONSchema = ZodObjectAny} SchemaT The input schema for the tool. Either any Zod object, a Zod string, or JSON schema instance.
 *
 * @param {RunnableFunc<z.output<SchemaT>, ToolReturnType>} func - The function to invoke when the tool is called.
 * @param {ToolWrapperParams<SchemaT>} fields - An object containing the following properties:
 * @param {string} fields.name The name of the tool.
 * @param {string | undefined} fields.description The description of the tool. Defaults to either the description on the Zod schema, or `${fields.name} tool`.
 * @param {ZodObjectAny | z.ZodString | undefined} fields.schema The Zod schema defining the input for the tool. If undefined, it will default to a Zod string schema.
 *
 * @returns {DynamicStructuredTool<SchemaT>} A new StructuredTool instance.
 */
export function tool<SchemaT extends z.ZodString>(
  func: RunnableFunc<
    SchemaT extends z.ZodString ? z.output<SchemaT> : string,
    ToolReturnType,
    ToolRunnableConfig
  >,
  fields: ToolWrapperParams<SchemaT>
): DynamicTool;

export function tool<
  SchemaT extends ZodObjectAny,
  SchemaOutputT = z.output<SchemaT>,
  SchemaInputT = z.input<SchemaT>
>(
  func: RunnableFunc<SchemaOutputT, ToolReturnType, ToolRunnableConfig>,
  fields: ToolWrapperParams<SchemaT>
): DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>;

export function tool<
  SchemaT extends JSONSchema,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>
>(
  func: RunnableFunc<
    Parameters<DynamicStructuredToolInput<SchemaT>["func"]>[0],
    ToolReturnType,
    ToolRunnableConfig
  >,
  fields: ToolWrapperParams<SchemaT>
): DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>;

export function tool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SchemaT extends ZodObjectAny | z.ZodString | JSONSchema = ZodObjectAny,
  SchemaOutputT = ToolInputSchemaOutputType<SchemaT>,
  SchemaInputT = ToolInputSchemaInputType<SchemaT>
>(
  func: RunnableFunc<SchemaOutputT, ToolReturnType, ToolRunnableConfig>,
  fields: ToolWrapperParams<SchemaT>
): SchemaT extends z.ZodString
  ? DynamicTool
  : SchemaT extends ZodObjectAny
  ? DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>
  : DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT> | DynamicTool {
  const isShapelessZodSchema =
    fields.schema &&
    isZodSchema(fields.schema) &&
    (!("shape" in fields.schema) || !fields.schema.shape);

  const isStringJSONSchema = validatesOnlyStrings(fields.schema);

  // If the schema is not provided, or it's a shapeless schema (e.g. a ZodString), create a DynamicTool
  if (!fields.schema || isShapelessZodSchema || isStringJSONSchema) {
    return new DynamicTool({
      ...fields,
      description:
        fields.description ??
        (fields.schema as { description?: string } | undefined)?.description ??
        `${fields.name} tool`,
      func: async (input, runManager, config) => {
        return new Promise((resolve, reject) => {
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
    }) as SchemaT extends z.ZodString
      ? DynamicTool
      : SchemaT extends ZodObjectAny
      ? DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>
      :
          | DynamicTool
          | DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>;
  }

  const schema = fields.schema as ZodObjectAny | JSONSchema;

  const description =
    fields.description ??
    (fields.schema as { description?: string }).description ??
    `${fields.name} tool`;

  return new DynamicStructuredTool<typeof schema, SchemaOutputT, SchemaInputT>({
    ...fields,
    description,
    schema,
    func: async (input, runManager, config) => {
      return new Promise((resolve, reject) => {
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
  }) as SchemaT extends z.ZodString
    ? DynamicTool
    : SchemaT extends ZodObjectAny
    ? DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>
    : DynamicTool | DynamicStructuredTool<SchemaT, SchemaOutputT, SchemaInputT>;
}

function _formatToolOutput(params: {
  content: unknown;
  name: string;
  artifact?: unknown;
  toolCallId?: string;
}): ToolReturnType {
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
    return JSON.stringify(content, null, 2);
  } catch (_noOp) {
    return `${content}`;
  }
}

import { z } from "zod";
import {
  CallbackManager,
  CallbackManagerForToolRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import {
  BaseLangChain,
  type BaseLangChainParams,
} from "../language_models/base.js";
import {
  ensureConfig,
  patchConfig,
  type RunnableConfig,
} from "../runnables/config.js";
import type { RunnableFunc, RunnableInterface } from "../runnables/base.js";
import { ToolCall, ToolMessage } from "../messages/tool.js";
import { MessageContent } from "../messages/base.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import { _isToolCall, ToolInputParsingException } from "./utils.js";
import { isZodSchema } from "../utils/types/is_zod_schema.js";

export { ToolInputParsingException };

export type ResponseFormat = "content" | "content_and_artifact" | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolReturnType = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentAndArtifact = [MessageContent, any];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodObjectAny = z.ZodObject<any, any, any, any>;

/**
 * Parameters for the Tool classes.
 */
export interface ToolParams extends BaseLangChainParams {
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
   * Whether to show full details in the thrown parsing errors.
   *
   * @default false
   */
  verboseParsingErrors?: boolean;
}

/**
 * Schema for defining tools.
 *
 * @version 0.2.19
 */
export interface StructuredToolParams
  extends Pick<StructuredToolInterface, "name" | "schema"> {
  /**
   * An optional description of the tool to pass to the model.
   */
  description?: string;
}

export interface StructuredToolInterface<T extends ZodObjectAny = ZodObjectAny>
  extends RunnableInterface<
    (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
    ToolReturnType
  > {
  lc_namespace: string[];

  /**
   * A Zod schema representing the parameters of the tool.
   */
  schema: T | z.ZodEffects<T>;

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
  call(
    arg: (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
    configArg?: Callbacks | RunnableConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<ToolReturnType>;

  /**
   * The name of the tool.
   */
  name: string;

  /**
   * A description of the tool.
   */
  description: string;

  returnDirect: boolean;
}

/**
 * Base class for Tools that accept input of any shape defined by a Zod schema.
 */
export abstract class StructuredTool<
  T extends ZodObjectAny = ZodObjectAny
> extends BaseLangChain<
  (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
  ToolReturnType
> {
  abstract name: string;

  abstract description: string;

  abstract schema: T | z.ZodEffects<T>;

  returnDirect = false;

  // TODO: Make default in 0.3
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
    arg: z.output<T>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: RunnableConfig
  ): Promise<ToolReturnType>;

  /**
   * Invokes the tool with the provided input and configuration.
   * @param input The input for the tool.
   * @param config Optional configuration for the tool.
   * @returns A Promise that resolves with a string.
   */
  async invoke(
    input:
      | (z.output<T> extends string ? string : never)
      | z.input<T>
      | ToolCall,
    config?: RunnableConfig
  ): Promise<ToolReturnType> {
    let tool_call_id: string | undefined;
    let toolInput:
      | (z.output<T> extends string ? string : never)
      | z.input<T>
      | ToolCall
      | undefined;

    if (_isToolCall(input)) {
      tool_call_id = input.id;
      toolInput = input.args;
    } else {
      toolInput = input;
    }

    const ensuredConfig = ensureConfig(config);
    return this.call(toolInput, {
      ...ensuredConfig,
      configurable: {
        ...ensuredConfig.configurable,
        tool_call_id,
      },
    });
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
    arg: (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
    configArg?: Callbacks | RunnableConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<ToolReturnType> {
    let parsed;
    try {
      parsed = await this.schema.parseAsync(arg);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      let message = `Received tool input did not match expected schema`;
      if (this.verboseParsingErrors) {
        message = `${message}\nDetails: ${e.message}`;
      }
      throw new ToolInputParsingException(message, JSON.stringify(arg));
    }

    const config = parseCallbackConfigArg(configArg);
    const callbackManager_ = await CallbackManager.configure(
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
      result = await this._call(parsed, runManager, config);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
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

export interface ToolInterface<T extends ZodObjectAny = ZodObjectAny>
  extends StructuredToolInterface<T> {
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
  ): Promise<ToolReturnType>;
}

/**
 * Base class for Tools that accept input as a string.
 */
export abstract class Tool extends StructuredTool<ZodObjectAny> {
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

export interface BaseDynamicToolInput extends ToolParams {
  name: string;
  description: string;
  returnDirect?: boolean;
}

/**
 * Interface for the input parameters of the DynamicTool class.
 */
export interface DynamicToolInput extends BaseDynamicToolInput {
  func: (
    input: string,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ) => Promise<ToolReturnType>;
}

/**
 * Interface for the input parameters of the DynamicStructuredTool class.
 */
export interface DynamicStructuredToolInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ZodObjectAny | Record<string, any> = ZodObjectAny
> extends BaseDynamicToolInput {
  func: (
    input: BaseDynamicToolInput["responseFormat"] extends "content_and_artifact"
      ? ToolCall
      : T extends ZodObjectAny
      ? z.infer<T>
      : T,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ) => Promise<ToolReturnType>;
  schema: T extends ZodObjectAny ? T : T;
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
    configArg?: RunnableConfig | Callbacks
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
    parentConfig?: RunnableConfig
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ZodObjectAny | Record<string, any> = ZodObjectAny
> extends StructuredTool<T extends ZodObjectAny ? T : ZodObjectAny> {
  static lc_name() {
    return "DynamicStructuredTool";
  }

  name: string;

  description: string;

  func: DynamicStructuredToolInput<T>["func"];

  schema: T extends ZodObjectAny ? T : ZodObjectAny;

  constructor(fields: DynamicStructuredToolInput<T>) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
    this.schema = (
      isZodSchema(fields.schema) ? fields.schema : z.object({}).passthrough()
    ) as T extends ZodObjectAny ? T : ZodObjectAny;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   */
  async call(
    arg: (T extends ZodObjectAny ? z.output<T> : T) | ToolCall,
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
    arg: (T extends ZodObjectAny ? z.output<T> : T) | ToolCall,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: RunnableConfig
  ): Promise<ToolReturnType> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.func(arg as any, runManager, parentConfig);
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
 * If you pass JSON schema, tool inputs will not be validated.
 * @template {ZodObjectAny | z.ZodString | Record<string, any> = ZodObjectAny} RunInput The input schema for the tool. Either any Zod object, a Zod string, or JSON schema.
 */
interface ToolWrapperParams<
  RunInput extends
    | ZodObjectAny
    | z.ZodString
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Record<string, any> = ZodObjectAny
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
}

/**
 * Creates a new StructuredTool instance with the provided function, name, description, and schema.
 *
 * Schema can be provided as Zod or JSON schema.
 * If you pass JSON schema, tool inputs will not be validated.
 *
 * @function
 * @template {ZodObjectAny | z.ZodString | Record<string, any> = ZodObjectAny} T The input schema for the tool. Either any Zod object, a Zod string, or JSON schema instance.
 *
 * @param {RunnableFunc<z.output<T>, ToolReturnType>} func - The function to invoke when the tool is called.
 * @param {ToolWrapperParams<T>} fields - An object containing the following properties:
 * @param {string} fields.name The name of the tool.
 * @param {string | undefined} fields.description The description of the tool. Defaults to either the description on the Zod schema, or `${fields.name} tool`.
 * @param {ZodObjectAny | z.ZodString | undefined} fields.schema The Zod schema defining the input for the tool. If undefined, it will default to a Zod string schema.
 *
 * @returns {DynamicStructuredTool<T>} A new StructuredTool instance.
 */
export function tool<T extends z.ZodString>(
  func: RunnableFunc<z.output<T>, ToolReturnType>,
  fields: ToolWrapperParams<T>
): DynamicTool;

export function tool<T extends ZodObjectAny>(
  func: RunnableFunc<z.output<T>, ToolReturnType>,
  fields: ToolWrapperParams<T>
): DynamicStructuredTool<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tool<T extends Record<string, any>>(
  func: RunnableFunc<T, ToolReturnType>,
  fields: ToolWrapperParams<T>
): DynamicStructuredTool<T>;

export function tool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ZodObjectAny | z.ZodString | Record<string, any> = ZodObjectAny
>(
  func: RunnableFunc<T extends ZodObjectAny ? z.output<T> : T, ToolReturnType>,
  fields: ToolWrapperParams<T>
):
  | DynamicStructuredTool<T extends ZodObjectAny ? T : ZodObjectAny>
  | DynamicTool {
  // If the schema is not provided, or it's a string schema, create a DynamicTool
  if (
    !fields.schema ||
    (isZodSchema(fields.schema) &&
      (!("shape" in fields.schema) || !fields.schema.shape))
  ) {
    return new DynamicTool({
      ...fields,
      description:
        fields.description ??
        fields.schema?.description ??
        `${fields.name} tool`,
      func: async (input, runManager, config) => {
        return new Promise((resolve, reject) => {
          const childConfig = patchConfig(config, {
            callbacks: runManager?.getChild(),
          });
          void AsyncLocalStorageProviderSingleton.runWithConfig(
            childConfig,
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

  const description =
    fields.description ?? fields.schema.description ?? `${fields.name} tool`;

  return new DynamicStructuredTool<T extends ZodObjectAny ? T : ZodObjectAny>({
    ...fields,
    description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: fields.schema as any,
    // TODO: Consider moving into DynamicStructuredTool constructor
    func: async (input, runManager, config) => {
      return new Promise((resolve, reject) => {
        const childConfig = patchConfig(config, {
          callbacks: runManager?.getChild(),
        });
        void AsyncLocalStorageProviderSingleton.runWithConfig(
          childConfig,
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

function _formatToolOutput(params: {
  content: unknown;
  name: string;
  artifact?: unknown;
  toolCallId?: string;
}): ToolReturnType {
  const { content, artifact, toolCallId } = params;
  if (toolCallId) {
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

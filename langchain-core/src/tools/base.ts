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
import { ensureConfig, type RunnableConfig } from "../runnables/config.js";
import type { RunnableFunc, RunnableInterface } from "../runnables/base.js";
import { ToolCall, ToolMessage } from "../messages/tool.js";
import { ZodAny } from "../types/zod.js";
import { MessageContent } from "../messages/base.js";

export type ResponseFormat = "content" | "contentAndRawOutput";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentAndRawOutput = [MessageContent, any];

/**
 * Parameters for the Tool classes.
 */
export interface ToolParams extends BaseLangChainParams {
  /**
   * The tool response format.
   *
   * If "content" then the output of the tool is interpreted as the contents of a
   * ToolMessage. If "contentAndRawOutput" then the output is expected to be a
   * two-tuple corresponding to the (content, raw_output) of a ToolMessage.
   *
   * @default "content"
   */
  responseFormat?: ResponseFormat;
}

/**
 * Custom error class used to handle exceptions related to tool input parsing.
 * It extends the built-in `Error` class and adds an optional `output`
 * property that can hold the output that caused the exception.
 */
export class ToolInputParsingException extends Error {
  output?: string;

  constructor(message: string, output?: string) {
    super(message);
    this.output = output;
  }
}

export interface StructuredToolInterface<
  T extends ZodAny = ZodAny,
  RunOutput extends string | ToolMessage = string
> extends RunnableInterface<
    (z.output<T> extends string ? string : never) | z.input<T>,
    RunOutput
  > {
  lc_namespace: string[];

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
  ): Promise<RunOutput>;

  name: string;

  description: string;

  returnDirect: boolean;
}

/**
 * Base class for Tools that accept input of any shape defined by a Zod schema.
 */
export abstract class StructuredTool<
  T extends ZodAny = ZodAny,
  RunOutput extends string | ToolMessage = string
> extends BaseLangChain<
  (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
  RunOutput
> {
  abstract schema: T | z.ZodEffects<T>;

  get lc_namespace() {
    return ["langchain", "tools"];
  }

  /**
   * The tool response format.
   *
   * If "content" then the output of the tool is interpreted as the contents of a
   * ToolMessage. If "contentAndRawOutput" then the output is expected to be a
   * two-tuple corresponding to the (content, raw_output) of a ToolMessage.
   *
   * @default "content"
   */
  responseFormat?: ResponseFormat = "content";

  constructor(fields?: ToolParams) {
    super(fields ?? {});

    this.responseFormat = fields?.responseFormat ?? this.responseFormat;
  }

  protected abstract _call(
    arg: z.output<T>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ): Promise<string | ContentAndRawOutput>;

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
  ): Promise<RunOutput> {
    const [toolInput, ensuredConfig] = await _prepRunArgs<T>(input, config);
    return this.call(toolInput, ensuredConfig) as Promise<RunOutput>;
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
  ): Promise<RunOutput> {
    let parsed;
    // Only parse the input if it's not a ToolCall
    if (_isToolCall(arg)) {
      parsed = arg;
    } else {
      try {
        parsed = await this.schema.parseAsync(arg);
      } catch (e) {
        throw new ToolInputParsingException(
          `Received tool input did not match expected schema`,
          JSON.stringify(arg)
        );
      }
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
    } catch (e) {
      await runManager?.handleToolError(e);
      throw e;
    }
    let content;
    let raw_output;
    if (this.responseFormat === "contentAndRawOutput") {
      if (Array.isArray(result) && result.length === 2) {
        [content, raw_output] = result;
      } else {
        throw new Error(
          `Tool response format is "contentAndRawOutput" but the output was not a two-tuple.\nResult: ${JSON.stringify(
            result
          )}`
        );
      }
    } else {
      content = result;
    }

    let tool_call_id: string | undefined;
    if (config.callbacks && "configurable" in config.callbacks) {
      tool_call_id = (
        config.callbacks.configurable as Record<string, string | undefined>
      ).tool_call;
    }
    const formattedOutput = _formatOutput(content, raw_output, tool_call_id);

    await runManager?.handleToolEnd(formattedOutput);
    return formattedOutput as RunOutput;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

export interface ToolInterface<
  T extends ZodAny = ZodAny,
  RunOutput extends string | ToolMessage = string
> extends StructuredToolInterface<T, RunOutput> {
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
  ): Promise<RunOutput>;
}

/**
 * Base class for Tools that accept input as a string.
 */
export abstract class Tool<
  RunOutput extends string | ToolMessage = string
> extends StructuredTool<ZodAny, RunOutput> {
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
  ): Promise<RunOutput> {
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
  ) => Promise<string | ContentAndRawOutput>;
}

/**
 * Interface for the input parameters of the DynamicStructuredTool class.
 */
export interface DynamicStructuredToolInput<
  T extends ZodAny = ZodAny
> extends BaseDynamicToolInput {
  func: (
    input: BaseDynamicToolInput["responseFormat"] extends "contentAndRawOutput"
      ? ToolCall
      : z.infer<T>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ) => Promise<string | ContentAndRawOutput>;
  schema: T;
}

/**
 * A tool that can be created dynamically from a function, name, and description.
 */
export class DynamicTool<
  RunOutput extends string | ToolMessage = string
> extends Tool<RunOutput> {
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
    arg: string | undefined | z.input<this["schema"]>,
    configArg?: RunnableConfig | Callbacks
  ): Promise<RunOutput> {
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
    config?: RunnableConfig
  ): Promise<string | ContentAndRawOutput> {
    return this.func(input, runManager, config);
  }
}

/**
 * A tool that can be created dynamically from a function, name, and
 * description, designed to work with structured data. It extends the
 * StructuredTool class and overrides the _call method to execute the
 * provided function when the tool is called.
 */
export class DynamicStructuredTool<
  T extends ZodAny = ZodAny,
  RunOutput extends string | ToolMessage = string
> extends StructuredTool<T, RunOutput> {
  static lc_name() {
    return "DynamicStructuredTool";
  }

  name: string;

  description: string;

  func: DynamicStructuredToolInput<T>["func"];

  schema: T;

  constructor(fields: DynamicStructuredToolInput<T>) {
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
    arg: z.output<T> | ToolCall,
    configArg?: RunnableConfig | Callbacks,
    /** @deprecated */
    tags?: string[]
  ): Promise<RunOutput> {
    const config = parseCallbackConfigArg(configArg);
    if (config.runName === undefined) {
      config.runName = this.name;
    }
    return super.call(arg, config, tags);
  }

  protected _call(
    arg: z.output<T> | ToolCall,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ): Promise<string | ContentAndRawOutput> {
    return this.func(arg, runManager, config);
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
 * @template {ZodAny} RunInput The input schema for the tool.
 * @template {string | ToolMessage} RunOutput The output type for the tool.
 */
interface ToolWrapperParams<RunInput extends ZodAny = ZodAny>
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
   * ToolMessage. If "contentAndRawOutput" then the output is expected to be a
   * two-tuple corresponding to the (content, raw_output) of a ToolMessage.
   *
   * @default "content"
   */
  responseFormat?: ResponseFormat;
}

/**
 * Creates a new StructuredTool instance with the provided function, name, description, and schema.
 * @function
 * @template {RunInput extends ZodAny = ZodAny} RunInput The input schema for the tool. This corresponds to the input type when the tool is invoked.
 * @template {RunOutput extends string | ToolMessage = string} RunOutput The output type for the tool. This corresponds to the output type when the tool is invoked.
 * @template {FuncInput extends z.infer<RunInput> | ToolCall = z.infer<RunInput>} FuncInput The input type for the function.
 *
 * @param {RunnableFunc<z.infer<RunInput> | ToolCall, RunOutput>} func - The function to invoke when the tool is called.
 * @param fields - An object containing the following properties:
 * @param {string} fields.name The name of the tool.
 * @param {string | undefined} fields.description The description of the tool. Defaults to either the description on the Zod schema, or `${fields.name} tool`.
 * @param {z.ZodObject<any, any, any, any>} fields.schema The Zod schema defining the input for the tool.
 *
 * @returns {DynamicStructuredTool<RunInput, RunOutput>} A new StructuredTool instance.
 */
export function tool<
  RunInput extends ZodAny = ZodAny,
  RunOutput extends ToolMessage = ToolMessage,
  FuncInput extends z.infer<RunInput> | ToolCall = z.infer<RunInput>,
>(
  func: RunnableFunc<FuncInput, ContentAndRawOutput>,
  fields: Omit<ToolWrapperParams<RunInput>, "responseFormat"> & {
    responseFormat: "contentAndRawOutput";
  }
): DynamicStructuredTool<RunInput, RunOutput>;

export function tool<
  RunInput extends ZodAny = ZodAny,
  RunOutput extends string = string,
  FuncInput extends z.infer<RunInput> | ToolCall = z.infer<RunInput>,
>(
  func: RunnableFunc<FuncInput, string>,
  fields: Omit<ToolWrapperParams<RunInput>, "responseFormat"> & {
    responseFormat?: "content" | undefined;
  }
): DynamicStructuredTool<RunInput, RunOutput>;

export function tool<
  RunInput extends ZodAny = ZodAny,
  RunOutput extends string | ToolMessage = string,
  FuncInput extends z.infer<RunInput> | ToolCall = z.infer<RunInput>,
  FuncOutput extends string | ContentAndRawOutput = string,
>(
  func: RunnableFunc<FuncInput, FuncOutput>,
  fields: ToolWrapperParams<RunInput>
): DynamicStructuredTool<RunInput, RunOutput> {
  const schema =
    fields.schema ??
    z.object({ input: z.string().optional() }).transform((obj) => obj.input);

  const description =
    fields.description ?? schema.description ?? `${fields.name} tool`;
  return new DynamicStructuredTool<RunInput, RunOutput>({
    name: fields.name,
    description,
    schema: schema as RunInput,
    func: async (input, _runManager, config) => func(input, config),
    responseFormat: fields.responseFormat,
  });
}

function _isToolCall(toolCall?: unknown): toolCall is ToolCall {
  return !!(
    toolCall &&
    typeof toolCall === "object" &&
    "type" in toolCall &&
    toolCall.type === "tool_call"
  );
}

async function _prepRunArgs<T extends ZodAny = ZodAny>(
  input: (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
  config?: RunnableConfig
): Promise<
  [
    (z.output<T> extends string ? string : never) | z.input<T> | ToolCall,
    Record<string, unknown>
  ]
> {
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

  return [
    toolInput,
    {
      ...ensuredConfig,
      configurable: {
        ...ensuredConfig.configurable,
        tool_call_id,
      },
    },
  ];
}

function _formatOutput(
  content: unknown,
  raw_output?: unknown,
  tool_call_id?: string
): ToolMessage | string {
  if (tool_call_id) {
    if (
      typeof content === "string" ||
      (Array.isArray(content) &&
        content.every((item) => typeof item === "object"))
    ) {
      return new ToolMessage({
        content,
        raw_output,
        tool_call_id,
      });
    } else {
      return new ToolMessage({
        content: _stringify(content),
        raw_output,
        tool_call_id,
      });
    }
  } else {
    return typeof content === "string" ? content : _stringify(content);
  }
}

function _stringify(content: unknown): string {
  try {
    return JSON.stringify(content, null, 2);
  } catch (_noOp) {
    return `${content}`;
  }
}

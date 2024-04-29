import { z } from "zod";
import {
  CallbackManager,
  CallbackManagerForToolRun,
  Callbacks,
  parseCallbackConfigArg,
} from "./callbacks/manager.js";
import {
  BaseLangChain,
  type BaseLangChainParams,
} from "./language_models/base.js";
import { ensureConfig, type RunnableConfig } from "./runnables/config.js";
import type { RunnableInterface } from "./runnables/base.js";

/**
 * Parameters for the Tool classes.
 */
export interface ToolParams extends BaseLangChainParams {}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends RunnableInterface<
    (z.output<T> extends string ? string : never) | z.input<T>,
    string
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
    arg: (z.output<T> extends string ? string : never) | z.input<T>,
    configArg?: Callbacks | RunnableConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<string>;

  name: string;

  description: string;

  returnDirect: boolean;
}

/**
 * Base class for Tools that accept input of any shape defined by a Zod schema.
 */
export abstract class StructuredTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends BaseLangChain<
  (z.output<T> extends string ? string : never) | z.input<T>,
  string
> {
  abstract schema: T | z.ZodEffects<T>;

  get lc_namespace() {
    return ["langchain", "tools"];
  }

  constructor(fields?: ToolParams) {
    super(fields ?? {});
  }

  protected abstract _call(
    arg: z.output<T>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ): Promise<string>;

  /**
   * Invokes the tool with the provided input and configuration.
   * @param input The input for the tool.
   * @param config Optional configuration for the tool.
   * @returns A Promise that resolves with a string.
   */
  async invoke(
    input: (z.output<T> extends string ? string : never) | z.input<T>,
    config?: RunnableConfig
  ): Promise<string> {
    return this.call(input, ensureConfig(config));
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
    arg: (z.output<T> extends string ? string : never) | z.input<T>,
    configArg?: Callbacks | RunnableConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<string> {
    let parsed;
    try {
      parsed = await this.schema.parseAsync(arg);
    } catch (e) {
      throw new ToolInputParsingException(
        `Received tool input did not match expected schema`,
        JSON.stringify(arg)
      );
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
    await runManager?.handleToolEnd(result);
    return result;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

export interface ToolInterface extends StructuredToolInterface {
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
    arg: string | undefined | z.input<this["schema"]>,
    callbacks?: Callbacks | RunnableConfig
  ): Promise<string>;
}

/**
 * Base class for Tools that accept input as a string.
 */
export abstract class Tool extends StructuredTool {
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
    arg: string | undefined | z.input<this["schema"]>,
    callbacks?: Callbacks | RunnableConfig
  ): Promise<string> {
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
  ) => Promise<string>;
}

/**
 * Interface for the input parameters of the DynamicStructuredTool class.
 */
export interface DynamicStructuredToolInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends BaseDynamicToolInput {
  func: (
    input: z.infer<T>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ) => Promise<string>;
  schema: T;
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
    arg: string | undefined | z.input<this["schema"]>,
    configArg?: RunnableConfig | Callbacks
  ): Promise<string> {
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
  ): Promise<string> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends StructuredTool {
  static lc_name() {
    return "DynamicStructuredTool";
  }

  name: string;

  description: string;

  func: DynamicStructuredToolInput["func"];

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
    arg: z.output<T>,
    configArg?: RunnableConfig | Callbacks,
    /** @deprecated */
    tags?: string[]
  ): Promise<string> {
    const config = parseCallbackConfigArg(configArg);
    if (config.runName === undefined) {
      config.runName = this.name;
    }
    return super.call(arg, config, tags);
  }

  protected _call(
    arg: z.output<T>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ): Promise<string> {
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

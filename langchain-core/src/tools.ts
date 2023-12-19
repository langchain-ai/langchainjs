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
import type { RunnableConfig } from "./runnables/config.js";

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
    runManager?: CallbackManagerForToolRun
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
    return this.call(input, config);
  }

  /**
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
      undefined,
      undefined,
      undefined,
      undefined,
      config.runName
    );
    let result;
    try {
      result = await this._call(parsed, runManager);
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

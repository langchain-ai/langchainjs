import { z } from "zod";
import {
  BaseCallbackConfig,
  CallbackManager,
  CallbackManagerForToolRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { BaseLangChain, BaseLangChainParams } from "../base_language/index.js";

export interface ToolParams extends BaseLangChainParams {}

/**
 * Base class for Tools that accept input of any shape defined by a Zod schema.
 */
export abstract class StructuredTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends BaseLangChain {
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

  async call(
    arg: (z.output<T> extends string ? string : never) | z.input<T>,
    configArg?: Callbacks | BaseCallbackConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<string> {
    const parsed = await this.schema.parseAsync(arg);
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
      typeof parsed === "string" ? parsed : JSON.stringify(parsed)
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

  call(
    arg: string | undefined | z.input<this["schema"]>,
    callbacks?: Callbacks
  ): Promise<string> {
    return super.call(
      typeof arg === "string" || !arg ? { input: arg } : arg,
      callbacks
    );
  }
}

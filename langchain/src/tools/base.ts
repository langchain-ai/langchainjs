import { z } from "zod";

import { CallbackManager, getCallbackManager } from "../callbacks/index.js";

const getVerbosity = () => false;

export interface ToolParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

export abstract class StructuredTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> {
  abstract schema: T | z.ZodEffects<T>;

  verbose: boolean;

  callbackManager: CallbackManager;

  constructor(verbose?: boolean, callbackManager?: CallbackManager) {
    this.verbose = verbose ?? (callbackManager ? true : getVerbosity());
    this.callbackManager = callbackManager ?? getCallbackManager();
  }

  protected abstract _call(arg: z.output<T>): Promise<string>;

  async call(
    arg: (z.output<T> extends string ? string : never) | z.input<T>,
    verbose?: boolean
  ): Promise<string> {
    const _verbose = verbose ?? this.verbose;
    const parsed = await this.schema.parseAsync(arg);
    await this.callbackManager.handleToolStart(
      { name: this.name },
      typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      _verbose
    );
    let result;
    try {
      result = await this._call(parsed);
    } catch (e) {
      await this.callbackManager.handleToolError(e, _verbose);
      throw e;
    }
    await this.callbackManager.handleToolEnd(result, _verbose);
    return result;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

export abstract class Tool extends StructuredTool {
  schema = /* #__PURE__ */ z
    // eslint-disable-next-line tree-shaking/no-side-effects-in-initialization
    .object({ input: /* #__PURE__ */ z.string() })
    // eslint-disable-next-line tree-shaking/no-side-effects-in-initialization
    /* #__PURE__ */ .transform((obj) => obj.input);

  call(
    arg: string | z.input<this["schema"]>,
    verbose?: boolean | undefined
  ): Promise<string> {
    return super.call(typeof arg === "string" ? { input: arg } : arg, verbose);
  }
}

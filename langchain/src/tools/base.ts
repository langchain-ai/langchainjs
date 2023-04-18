import {
  CallbackManager,
  CallbackManagerForToolRun,
} from "../callbacks/manager.js";
import { BaseLangChain } from "../base_language/index.js";
import { BaseCallbackHandler } from "../callbacks/index.js";

export interface ToolParams {
  verbose?: boolean;

  callbackHandlers?: BaseCallbackHandler[];

  /**
   * @deprecated Use `callbackHandlers` instead
   */
  callbackManager?: CallbackManager;
}

export abstract class Tool extends BaseLangChain {
  constructor(
    verbose?: boolean,
    callbackManager?: CallbackManager,
    callbackHandlers?: BaseCallbackHandler[]
  ) {
    super(verbose, callbackHandlers, callbackManager);
  }

  protected abstract _call(
    arg: string,
    callbackManager?: CallbackManagerForToolRun
  ): Promise<string>;

  async call(
    arg: string,
    callbacks?: CallbackManager | BaseCallbackHandler[]
  ): Promise<string> {
    const callbackManager_ = await CallbackManager.configure(
      Array.isArray(callbacks) ? callbacks : callbacks?.handlers,
      this.callbackHandlers ?? this.callbackManager?.handlers
    );
    const runManager = await callbackManager_?.handleToolStart(
      { name: this.name },
      arg
    );
    let result;
    try {
      result = await this._call(arg, runManager);
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

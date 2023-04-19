import {
  CallbackManager,
  CallbackManagerForToolRun,
} from "../callbacks/manager.js";
import { BaseLangChain, BaseLangChainParams } from "../base_language/index.js";
import { BaseCallbackHandler } from "../callbacks/index.js";

export interface ToolParams extends BaseLangChainParams {
  /**
   * @deprecated Use `callbacks` instead
   */
  callbackManager?: CallbackManager;
}

export abstract class Tool extends BaseLangChain {
  constructor(
    verbose?: boolean,
    callbacks?: CallbackManager | BaseCallbackHandler[]
  ) {
    super({ verbose, callbacks });
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
      callbacks,
      Array.isArray(this.callbacks) ? this.callbacks : this.callbacks?.handlers,
      { verbose: this.verbose }
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

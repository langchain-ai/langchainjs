import { CallbackManager } from "../callbacks/base.js";
import { BaseLangChain } from "../base_language/index.js";

export interface ToolParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

export abstract class Tool extends BaseLangChain {
  constructor(verbose?: boolean, callbackManager?: CallbackManager) {
    super(verbose, callbackManager);
  }

  protected abstract _call(
    arg: string,
    callbackManager?: CallbackManager
  ): Promise<string>;

  async call(
    arg: string,
    _verbose?: boolean,
    callbackManager?: CallbackManager
  ): Promise<string> {
    const localCallbackManager = this.configureCallbackManager(callbackManager);
    await localCallbackManager?.handleToolStart({ name: this.name }, arg);
    let result;
    try {
      result = await this._call(arg, callbackManager);
    } catch (e) {
      await localCallbackManager?.handleToolError(e);
      throw e;
    }
    await localCallbackManager?.handleToolEnd(result);
    return result;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

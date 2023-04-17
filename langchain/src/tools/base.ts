import {
  CallbackManager,
  CallbackManagerForToolRun,
} from "../callbacks/manager.js";
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
    callbackManager?: CallbackManagerForToolRun
  ): Promise<string>;

  async call(arg: string, callbackManager?: CallbackManager): Promise<string> {
    const runManager = await this.configureCallbackManager(
      callbackManager
    )?.handleToolStart({ name: this.name }, arg);
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

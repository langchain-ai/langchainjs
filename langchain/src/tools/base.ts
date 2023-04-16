import { CallbackManager, ConsoleCallbackHandler } from "../callbacks/base.js";

const getVerbosity = () => false;

export interface ToolParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

export abstract class Tool {
  verbose: boolean;

  callbackManager?: CallbackManager;

  constructor(verbose?: boolean, callbackManager?: CallbackManager) {
    this.verbose = verbose ?? (callbackManager ? true : getVerbosity());
    this.callbackManager = callbackManager;
  }

  protected configureCallbackManager(
    callbackManager?: CallbackManager
  ): CallbackManager | undefined {
    let callbackManager_ =
      callbackManager?.copy(this.callbackManager?.handlers) ??
      this.callbackManager;
    if (this.verbose) {
      if (!callbackManager_) {
        callbackManager_ = new CallbackManager();
      }
      callbackManager_.addHandler(new ConsoleCallbackHandler());
    }
    return callbackManager_;
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

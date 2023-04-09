import { CallbackManager, getCallbackManager } from "../../callbacks/index.js";

const getVerbosity = () => false;

export interface ToolParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

export abstract class Tool {
  verbose: boolean;

  callbackManager: CallbackManager;

  constructor(verbose?: boolean, callbackManager?: CallbackManager) {
    this.verbose = verbose ?? getVerbosity();
    this.callbackManager = callbackManager ?? getCallbackManager();
  }

  protected abstract _call(
    arg: string,
    callbackManager?: CallbackManager
  ): Promise<string>;

  async call(
    arg: string,
    verbose?: boolean,
    callbackManager?: CallbackManager
  ): Promise<string> {
    const verbose_ = verbose ?? this.verbose;
    const callbackManager_ =
      callbackManager?.copy(this.callbackManager.handlers) ??
      this.callbackManager;
    for (const handler of this.callbackManager.handlers) {
      callbackManager_.addHandler(handler);
    }
    const runId = await callbackManager_.handleToolStart(
      { name: this.name },
      arg,
      undefined,
      verbose_
    );
    let result;
    try {
      result = await this._call(arg, callbackManager);
    } catch (e) {
      await callbackManager_.handleToolError(e, runId, verbose_);
      throw e;
    }
    await callbackManager_.handleToolEnd(result, runId, verbose_);
    return result;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

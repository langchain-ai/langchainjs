import { CallbackManager, getCallbackManager } from "../callbacks/index.js";

const getVerbosity = () => false;

export interface ToolParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

export abstract class Tool {
  verbose: boolean;

  callbackManager: CallbackManager;

  constructor(verbose?: boolean, callbackManager?: CallbackManager) {
    this.verbose = verbose ?? (callbackManager ? true : getVerbosity());
    this.callbackManager = callbackManager ?? getCallbackManager();
  }

  protected abstract _call(arg: string): Promise<string>;

  async call(arg: string, verbose?: boolean): Promise<string> {
    const _verbose = verbose ?? this.verbose;
    await this.callbackManager.handleToolStart(
      { name: this.name },
      arg,
      _verbose
    );
    let result;
    try {
      result = await this._call(arg);
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

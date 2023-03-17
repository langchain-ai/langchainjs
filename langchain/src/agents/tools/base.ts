import {
  CallbackManager,
  getCallbackManager,
  TRACER_RUN_ID,
} from "../../callbacks/index.js";
import { RunId } from "../../callbacks/base.js";

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

  protected abstract _call(arg: string): Promise<string>;

  async call(
    arg: string,
    callerId?: RunId,
    verbose?: boolean
  ): Promise<string> {
    const _verbose = verbose ?? this.verbose;
    const values = await this.callbackManager.handleToolStart(
      { name: this.name },
      arg,
      callerId,
      _verbose
    );
    let result;
    const runId = values[TRACER_RUN_ID];
    try {
      result = await this._call(arg);
    } catch (e) {
      await this.callbackManager.handleToolError(e, runId, _verbose);
      throw e;
    }
    await this.callbackManager.handleToolEnd(result, runId, _verbose);
    return result;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

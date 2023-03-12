import {CallbackManager, getCallbackManager} from "../../callbacks/index.js";

const getVerbosity = () => true;

export interface ToolParams {
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

export abstract class Tool {

  verbose: boolean;

  callbackManager: CallbackManager;

  constructor(
      verbose?: boolean,
      callbackManager?: CallbackManager
  ) {
    this.verbose = verbose ?? getVerbosity();
    this.callbackManager = callbackManager ?? getCallbackManager();
  }

  protected abstract _call(arg: string): Promise<string>;

  async call(arg: string): Promise<string> {
    await this.callbackManager.handleToolStart({name: this.name}, arg, this.verbose);
    let result;
    try {
        result = await this._call(arg);
    } catch (e) {
        await this.callbackManager.handleToolError(e, this.verbose);
        throw e;
    }
    await this.callbackManager.handleToolEnd(result, this.verbose);
    return result;
  }

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}

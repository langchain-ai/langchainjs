import { BaseCallbackHandler } from "../callbacks/base.js";
import {
  CallbackManagerForToolRun,
  CallbackManager,
} from "../callbacks/manager.js";
import { Tool } from "./base.js";

export interface DynamicToolInput {
  name: string;
  description: string;
  func: (arg1: string) => Promise<string>;
  returnDirect?: boolean;
  verbose?: boolean;
  callbacks?: BaseCallbackHandler[] | CallbackManager;
}

export class DynamicTool extends Tool {
  name: string;

  description: string;

  func: (arg1: string) => Promise<string>;

  constructor(fields: DynamicToolInput) {
    super(fields.verbose, fields.callbacks);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
  }

  /** @ignore */
  async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return this.func(input);
  }
}

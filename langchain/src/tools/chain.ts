import { BaseCallbackHandler } from "../callbacks/base.js";
import {
  CallbackManager,
  CallbackManagerForToolRun,
} from "../callbacks/manager.js";
import { DynamicToolInput } from "./dynamic.js";
import { BaseChain } from "../chains/base.js";
import { Tool } from "./base.js";

export interface ChainToolInput extends Omit<DynamicToolInput, "func"> {
  chain: BaseChain;
}

export class ChainTool extends Tool {
  name: string;

  description: string;

  chain: BaseChain;

  returnDirect: boolean;

  constructor(fields: {
    name: string;
    description: string;
    chain: BaseChain;
    returnDirect?: boolean;
    verbose?: boolean;
    callbacks?: CallbackManager | BaseCallbackHandler[];
  }) {
    super(fields.verbose, fields.callbacks);
    this.name = fields.name;
    this.description = fields.description;
    this.chain = fields.chain;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
    this.verbose = fields.verbose ?? this.verbose;
    this.callbacks = fields.callbacks ?? this.callbacks;
  }

  /** @ignore */
  async _call(
    input: string,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return this.chain.run(input, runManager?.getChild());
  }
}

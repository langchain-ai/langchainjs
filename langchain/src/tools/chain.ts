import { CallbackManager } from "callbacks/base.js";
import { Tool } from "./base.js";
import { BaseChain } from "../chains/base.js";

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
    callbackManager?: CallbackManager
  }) {
    super(fields.verbose, fields.callbackManager);
    this.name = fields.name;
    this.description = fields.description;
    this.chain = fields.chain;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    return this.chain.run(input);
  }
}

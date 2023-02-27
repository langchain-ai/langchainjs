import { Tool } from "./base.js";
import { BaseChain } from "../../chains/base.js";

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
  }) {
    super();
    this.name = fields.name;
    this.description = fields.description;
    this.chain = fields.chain;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
  }

  async call(input: string): Promise<string> {
    return this.chain.run(input);
  }
}

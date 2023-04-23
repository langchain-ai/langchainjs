import { DynamicTool, DynamicToolInput } from "./dynamic.js";
import { BaseChain } from "../chains/base.js";

export interface ChainToolInput extends Omit<DynamicToolInput, "func"> {
  chain: BaseChain;
}

export class ChainTool extends DynamicTool {
  chain: BaseChain;

  constructor({ chain, ...rest }: ChainToolInput) {
    super({
      ...rest,
      func: async (input, runManager) =>
        chain.run(input, runManager?.getChild()),
    });
    this.chain = chain;
  }
}

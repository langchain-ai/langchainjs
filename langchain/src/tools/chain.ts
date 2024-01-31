import { DynamicTool, DynamicToolInput } from "@langchain/core/tools";
import { BaseChain } from "../chains/base.js";

/**
 * @deprecated Wrap in a DynamicTool instead.
 * Interface for the input parameters of the ChainTool constructor.
 * Extends the DynamicToolInput interface, replacing the 'func' property
 * with a 'chain' property.
 */
export interface ChainToolInput extends Omit<DynamicToolInput, "func"> {
  chain: BaseChain;
}

/**
 * @deprecated Wrap in a DynamicTool instead.
 * Class that extends DynamicTool for creating tools that can run chains.
 * Takes an instance of a class that extends BaseChain as a parameter in
 * its constructor and uses it to run the chain when its 'func' method is
 * called.
 */
export class ChainTool extends DynamicTool {
  static lc_name() {
    return "ChainTool";
  }

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

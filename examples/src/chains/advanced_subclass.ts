import { CallbackManagerForChainRun } from "langchain/callbacks";
import { BaseMemory } from "langchain/memory";
import { ChainValues } from "langchain/schema";

abstract class BaseChain {
  memory?: BaseMemory;

  /**
   * Run the core logic of this chain and return the output
   */
  abstract _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues>;

  /**
   * Return the string type key uniquely identifying this class of chain.
   */
  abstract _chainType(): string;

  /**
   * Return the list of input keys this chain expects to receive when called.
   */
  abstract get inputKeys(): string[];

  /**
   * Return the list of output keys this chain will produce when called.
   */
  abstract get outputKeys(): string[];
}

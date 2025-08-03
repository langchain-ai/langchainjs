import {
  CallbackManagerForChainRun,
  Callbacks,
} from "@langchain/core/callbacks/manager";
import { ChainValues } from "@langchain/core/utils/types";
import { ChainInputs, BaseChain } from "./base.js";

/**
 * Interface that extends the `ChainInputs` interface and defines the
 * fields required for a transform chain. It includes the `transform`
 * function, `inputVariables`, and `outputVariables` properties.
 *
 * @deprecated
 * Switch to expression language: https://js.langchain.com/docs/expression_language/
 * Will be removed in 0.2.0
 */
export interface TransformChainFields<
  I extends ChainValues,
  O extends ChainValues
> extends ChainInputs {
  transform: (values: I, callbacks?: Callbacks) => O | Promise<O>;
  inputVariables: (keyof I extends string ? keyof I : never)[];
  outputVariables: (keyof O extends string ? keyof O : never)[];
}

/**
 * Class that represents a transform chain. It extends the `BaseChain`
 * class and implements the `TransformChainFields` interface. It provides
 * a way to transform input values to output values using a specified
 * transform function.
 *
 * @deprecated
 * Switch to {@link https://js.langchain.com/docs/expression_language/ | expression language}.
 * Will be removed in 0.2.0
 */
export class TransformChain<
  I extends ChainValues,
  O extends ChainValues
> extends BaseChain {
  static lc_name() {
    return "TransformChain";
  }

  transformFunc: (values: I, callbacks?: Callbacks) => O | Promise<O>;

  inputVariables: (keyof I extends string ? keyof I : never)[];

  outputVariables: (keyof O extends string ? keyof O : never)[];

  _chainType() {
    return "transform" as const;
  }

  get inputKeys() {
    return this.inputVariables;
  }

  get outputKeys() {
    return this.outputVariables;
  }

  constructor(fields: TransformChainFields<I, O>) {
    super(fields);
    this.transformFunc = fields.transform;
    this.inputVariables = fields.inputVariables;
    this.outputVariables = fields.outputVariables;
  }

  async _call(values: I, runManager?: CallbackManagerForChainRun): Promise<O> {
    return this.transformFunc(values, runManager?.getChild("transform"));
  }
}

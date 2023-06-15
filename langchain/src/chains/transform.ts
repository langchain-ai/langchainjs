import { CallbackManagerForChainRun, Callbacks } from "../callbacks/manager.js";
import { ChainValues } from "../schema/index.js";
import { ChainInputs, BaseChain } from "./base.js";

export interface TransformChainFields<
  I extends ChainValues,
  O extends ChainValues
> extends ChainInputs {
  transform: (values: I, callbacks?: Callbacks) => O | Promise<O>;
  inputVariables: (keyof I extends string ? keyof I : never)[];
  outputVariables: (keyof O extends string ? keyof O : never)[];
}

export class TransformChain<I extends ChainValues, O extends ChainValues>
  extends BaseChain
  implements TransformChainFields<I, O>
{
  transform: (values: I, callbacks?: Callbacks) => O | Promise<O>;

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
    this.transform = fields.transform;
    this.inputVariables = fields.inputVariables;
    this.outputVariables = fields.outputVariables;
  }

  async _call(values: I, runManager?: CallbackManagerForChainRun): Promise<O> {
    return this.transform(values, runManager?.getChild("transform"));
  }
}

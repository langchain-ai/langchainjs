import { DynamicTool } from "./dynamic.js";
import { CallbackManagerForToolRun, Callbacks } from "../callbacks/index.js";

export interface BaseHumanInput {
  returnDirect?: boolean;
  verbose?: boolean;
  callbacks?: Callbacks;
}
export interface HumanToolInput extends BaseHumanInput {
  func?: (
    input: string,
    runManager?: CallbackManagerForToolRun
  ) => Promise<string>;
}

/**
 * Tool that adds the capability to ask user for input.
 */
export class HumanTool extends DynamicTool {
  constructor(input: HumanToolInput = {}) {
    super({
      verbose: input.verbose,
      callbacks: input.callbacks,
      name: "human",
      description:
        "You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human.",
      func: input.func ?? (async (input: string) => input),
      returnDirect: input.returnDirect ?? true,
    });
  }
}

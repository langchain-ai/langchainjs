import { CallbackManagerForToolRun, Callbacks } from "../callbacks/manager.js";
import { Tool } from "./base.js";

export interface DynamicToolInput {
  name: string;
  description: string;
  func: (
    input: string,
    runManager?: CallbackManagerForToolRun
  ) => Promise<string>;
  returnDirect?: boolean;
  verbose?: boolean;
  callbacks?: Callbacks;
}

export class DynamicTool extends Tool {
  name: string;

  description: string;

  func: DynamicToolInput["func"];

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
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return this.func(input, runManager);
  }
}

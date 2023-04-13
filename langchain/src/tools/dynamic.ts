import { Tool } from "./base.js";

export interface DynamicToolParams {
  name: string;
  description: string;
  func: (arg1: string) => Promise<string>;
}

export class DynamicTool extends Tool {
  name: string;

  description: string;

  func: (arg1: string) => Promise<string>;

  constructor(fields: DynamicToolParams) {
    super();
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
  }

  async _call(input: string): Promise<string> {
    return this.func(input);
  }
}

import { Tool } from "./base.js";

export class DynamicTool extends Tool {
  name: string;

  description: string;

  func: (arg1: string) => Promise<string>;

  constructor(fields: {
    name: string;
    description: string;
    func: (arg1: string) => Promise<string>;
  }) {
    super();
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
  }

  async call(input: string): Promise<string> {
    return this.func(input);
  }
}

import { Parser } from "expr-eval";

import { Tool } from "./base.js";

export class Calculator extends Tool {
  name = "calculator";

  async call(input: string) {
    try {
      return Parser.evaluate(input).toString();
    } catch (error: any) {
      return `javascript failed to parse. Try again: ${error.toString()}`;
    }
  }

  description = `Useful for getting the result of a math expression. 
  The input to this tool should be a well formed string math expression to be parsed and evaluated by expr-eval npm package."`;
}

import { Parser } from "expr-eval";

import { Tool } from ".";

export const Calculator: Tool = {
  name: "calculator",
  call: async (input: string) => {
    try {
      return Parser.evaluate(input).toString();
    } catch (error) {
      return "I don't know how to do that.";
    }
  },
  description: "Useful for getting the result of a math expression.",
};

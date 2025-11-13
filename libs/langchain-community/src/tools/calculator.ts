import Mexp from "math-expression-evaluator";

import { Tool } from "@langchain/core/tools";

/**
 * The Calculator class is a tool used to evaluate mathematical
 * expressions. It extends the base Tool class.
 * @example
 * ```typescript
 * import { Calculator } from "@langchain/community/tools/calculator";
 *
 * const calculator = new Calculator();
 * const sum = await calculator.invoke("99 + 99");
 * console.log("The sum of 99 and 99 is:", sum);
 * // The sum of 99 and 99 is: 198
 * ```
 */

const Parser = new Mexp();
export class Calculator extends Tool {
  static lc_name() {
    return "Calculator";
  }

  get lc_namespace() {
    return [...super.lc_namespace, "calculator"];
  }

  name = "calculator";

  /** @ignore */
  async _call(input: string) {
    try {
      return Parser.eval(input).toString();
    } catch (error) {
      return "I don't know how to do that.";
    }
  }

  description = `Useful for getting the result of a math expression. The input to this tool should be a valid mathematical expression that could be executed by a simple calculator.`;
}

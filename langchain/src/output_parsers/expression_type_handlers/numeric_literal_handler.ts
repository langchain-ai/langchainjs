import type { ESTree } from "meriyah";
import { NodeHandler, ASTParser } from "./base.js";
import { NumericLiteralType } from "./types.js";

export class NumericLiteralHandler extends NodeHandler {
  async accepts(node: ESTree.Node): Promise<ESTree.Literal | boolean> {
    if (ASTParser.isNumericLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: ESTree.Literal): Promise<NumericLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    return {
      type: "numeric_literal",
      value: Number(node.value),
    };
  }
}

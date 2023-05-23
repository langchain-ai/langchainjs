import type { ESTree } from "meriyah";
import { NodeHandler, ASTParser } from "./base.js";
import { BooleanLiteralType } from "./types.js";

export class BooleanLiteralHandler extends NodeHandler {
  async accepts(node: ESTree.Node): Promise<ESTree.Literal | boolean> {
    if (ASTParser.isBooleanLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: ESTree.Literal): Promise<BooleanLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    return {
      type: "boolean_literal",
      value: node.value as boolean,
    };
  }
}

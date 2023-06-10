import { NodeHandler, ASTParser } from "./base.js";
import { BooleanLiteralType } from "./types.js";

export class BooleanLiteralHandler extends NodeHandler {
  async accepts(node: ExpressionNode): Promise<BooleanLiteral | boolean> {
    if (ASTParser.isBooleanLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: BooleanLiteral): Promise<BooleanLiteralType> {
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

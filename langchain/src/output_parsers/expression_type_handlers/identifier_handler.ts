import { NodeHandler, ASTParser } from "./base.js";
import { IdentifierType } from "./types.js";

export class IdentifierHandler extends NodeHandler {
  async accepts(node: ExpressionNode): Promise<Identifier | boolean> {
    if (ASTParser.isIdentifier(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: Identifier): Promise<IdentifierType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const text = node.name.replace(/^["'](.+(?=["']$))["']$/, "$1");
    return { type: "identifier", value: text };
  }
}

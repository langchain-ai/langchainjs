import type { ESTree } from "meriyah";
import { NodeHandler, ASTParser } from "./base.js";
import { StringLiteralType } from "./types.js";

export class StringLiteralHandler extends NodeHandler {
  async accepts(node: ESTree.Node): Promise<ESTree.Literal | boolean> {
    if (ASTParser.isStringLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: ESTree.Literal): Promise<StringLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const text = (`${node.value}` as string).replace(
      /^["'](.+(?=["']$))["']$/,
      "$1"
    );
    return { type: "string_literal", value: text };
  }
}

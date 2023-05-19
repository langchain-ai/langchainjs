import type { ESTree } from "meriyah";
import { NodeHandler, ASTParser } from "./base.js";
import { ArrayLiteralType } from "./types.js";

export class ArrayLiteralExpressionHandler extends NodeHandler {
  async accepts(node: ESTree.Node): Promise<ESTree.ArrayExpression | boolean> {
    if (ASTParser.isArrayExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: ESTree.ArrayExpression): Promise<ArrayLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    return {
      type: "array_literal",
      values: await Promise.all(
        node.elements.map((innerNode) =>
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.parentHandler!.handle(innerNode as ESTree.Node)
        )
      ),
    };
  }
}

import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, BooleanLiteralType } from "./types.js";

export class BooleanLiteralHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.BooleanLiteral | boolean> {
    const ts = await TSImporter.importTS();
    if (
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword
    ) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.BooleanLiteral): Promise<BooleanLiteralType> {
    const ts = await TSImporter.importTS();
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    return {
      type: "boolean_literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
    };
  }
}

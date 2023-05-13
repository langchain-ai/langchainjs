import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, NumericLiteralType } from "./types.js";

export class NumericLiteralHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.NumericLiteral | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isNumericLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.NumericLiteral): Promise<NumericLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    return {
      type: "numeric_literal",
      value: Number(node.getText().replace(/^["'](.+(?=["']$))["']$/, "$1")),
    };
  }
}

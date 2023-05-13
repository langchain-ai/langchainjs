import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, StringLiteralType } from "./types.js";

export class StringLiteralHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.StringLiteral | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isStringLiteral(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.StringLiteral): Promise<StringLiteralType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const text = node.getText().replace(/^["'](.+(?=["']$))["']$/, "$1");
    return { type: "string_literal", value: text };
  }
}

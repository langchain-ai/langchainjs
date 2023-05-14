import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, IdentifierType } from "./types.js";

export class IdentifierHandler extends NodeHandler {
  async accepts(node: AcceptableNodeTypes): Promise<tst.Identifier | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isIdentifier(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.Identifier): Promise<IdentifierType> {
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const text = node.getText().replace(/^["'](.+(?=["']$))["']$/, "$1");
    return { type: "identifier", value: text };
  }
}

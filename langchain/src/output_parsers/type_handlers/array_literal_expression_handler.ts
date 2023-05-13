import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { AcceptableNodeTypes, ArrayLiteralType } from "./types.js";

export class ArrayLiteralExpressionHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.ArrayLiteralExpression | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isArrayLiteralExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.ArrayLiteralExpression): Promise<ArrayLiteralType> {
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
          this.parentHandler!.handle(innerNode as AcceptableNodeTypes)
        )
      ),
    };
  }
}

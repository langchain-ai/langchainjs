import type * as tst from "typescript";
import { NodeHandler, TSImporter } from "./base.js";
import { PropertyAssignmentHandler } from "./property_assignment_handler.js";
import {
  AcceptableNodeTypes,
  ObjectLiteralType,
  PropertyAssignmentType,
} from "./types.js";

export class ObjectLiteralExpressionHandler extends NodeHandler {
  async accepts(
    node: AcceptableNodeTypes
  ): Promise<tst.ObjectLiteralExpression | boolean> {
    const ts = await TSImporter.importTS();
    if (ts.isObjectLiteralExpression(node)) {
      return node;
    } else {
      return false;
    }
  }

  async handle(node: tst.ObjectLiteralExpression): Promise<ObjectLiteralType> {
    const ts = await TSImporter.importTS();
    if (!this.parentHandler) {
      throw new Error(
        "ArrayLiteralExpressionHandler must have a parent handler"
      );
    }
    const values: PropertyAssignmentType[] = [];
    const { properties } = node;
    for (const property of properties) {
      if (ts.isPropertyAssignment(property)) {
        values.push(
          await new PropertyAssignmentHandler(this.parentHandler).handle(
            property
          )
        );
      }
    }
    return { type: "object_literal", values };
  }
}

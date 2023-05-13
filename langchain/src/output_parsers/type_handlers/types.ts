import type * as ts from "typescript";

export type ArgumentsType =
  | IdentifierType
  | StringLiteralType
  | NumericLiteralType
  | ArrayLiteralType
  | ObjectLiteralType
  | CallExpressionType
  | BooleanLiteralType;

export type ParsedType =
  | ArgumentsType
  | ElementAccessExpressionType
  | PropertyAccessType
  | PropertyAssignmentType;

export type AcceptableNodeTypes =
  | ts.ExpressionStatement
  | ts.CallExpression
  | ts.Identifier
  | ts.PropertyAccessExpression
  | ts.ElementAccessExpression
  | ts.StringLiteral
  | ts.NumericLiteral
  | ts.CallExpression
  | ts.ArrayLiteralExpression
  | ts.ObjectLiteralExpression
  | ts.PropertyAssignment
  | ts.BooleanLiteral;

export type ArrayLiteralType = {
  type: "array_literal";
  values: ArgumentsType[];
};

export type BooleanLiteralType = {
  type: "boolean_literal";
  value: boolean;
};

export type CallExpressionType = {
  type: "call_expression";
  funcCall: string | ElementAccessExpressionType | PropertyAccessType;
  args?: ArgumentsType[];
};
export type ElementAccessExpressionType = {
  type: "element_access_expression";
  identifier: string | string[];
  key?: string | number;
};

export type NumericLiteralType = {
  type: "numeric_literal";
  value: number;
};

export type ObjectLiteralType = {
  type: "object_literal";
  values: PropertyAssignmentType[];
};

export type PropertyAccessType = {
  type: "property_access_expression";
  identifier: string | PropertyAccessType;
  property: string;
};

export type PropertyAssignmentType = {
  type: "property_assignment";
  identifier: string;
  value: ArgumentsType;
};

export type StringLiteralType = {
  type: "string_literal";
  value: string;
};

export type IdentifierType = {
  type: "identifier";
  value: string;
};

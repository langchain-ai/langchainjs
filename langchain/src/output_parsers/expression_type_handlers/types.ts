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

export type MemberAccessType = {
  type: "member_access_expression";
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

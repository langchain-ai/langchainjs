export type ArgumentsType =
  | IdentifierType
  | StringLiteralType
  | NumericLiteralType
  | ArrayLiteralType
  | ObjectLiteralType
  | CallExpressionType
  | BooleanLiteralType;

export type ParsedType = ArgumentsType | PropertyAssignmentType;

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
  funcCall: string | MemberExpressionType;
  args?: ArgumentsType[];
};

export type NumericLiteralType = {
  type: "numeric_literal";
  value: number;
};

export type ObjectLiteralType = {
  type: "object_literal";
  values: PropertyAssignmentType[];
};

export type MemberExpressionType = {
  type: "member_expression";
  identifier: string;
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

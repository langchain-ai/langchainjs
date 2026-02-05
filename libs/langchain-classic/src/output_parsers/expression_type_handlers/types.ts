/**
 * Represents the different types of arguments that can be used in
 * LangChain.
 */
export type ArgumentsType =
  | IdentifierType
  | StringLiteralType
  | NumericLiteralType
  | ArrayLiteralType
  | ObjectLiteralType
  | CallExpressionType
  | BooleanLiteralType;

/**
 * Represents the parsed types in LangChain, which can be either an
 * ArgumentsType or a PropertyAssignmentType.
 */
export type ParsedType = ArgumentsType | PropertyAssignmentType;

/**
 * Represents an array literal in LangChain. It has a type property set to
 * 'array_literal' and a values property which is an array of
 * ArgumentsType.
 */
export type ArrayLiteralType = {
  type: "array_literal";
  values: ArgumentsType[];
};

/**
 * Represents a boolean literal in LangChain. It has a type property set
 * to 'boolean_literal' and a value property which is a boolean.
 */
export type BooleanLiteralType = {
  type: "boolean_literal";
  value: boolean;
};

/**
 * Represents a call expression in LangChain. It has a type property set
 * to 'call_expression', a funcCall property which can be a string or a
 * MemberExpressionType, and an optional args property which is an array
 * of ArgumentsType.
 */
export type CallExpressionType = {
  type: "call_expression";
  funcCall: string | MemberExpressionType;
  args?: ArgumentsType[];
};

/**
 * Represents a numeric literal in LangChain. It has a type property set
 * to 'numeric_literal' and a value property which is a number.
 */
export type NumericLiteralType = {
  type: "numeric_literal";
  value: number;
};

/**
 * Represents an object literal in LangChain. It has a type property set
 * to 'object_literal' and a values property which is an array of
 * PropertyAssignmentType.
 */
export type ObjectLiteralType = {
  type: "object_literal";
  values: PropertyAssignmentType[];
};

/**
 * Represents a member expression in LangChain. It has a type property set
 * to 'member_expression', an identifier property which is a string, and a
 * property property which is also a string.
 */
export type MemberExpressionType = {
  type: "member_expression";
  identifier: string;
  property: string;
};

/**
 * Represents a property assignment in LangChain. It has a type property
 * set to 'property_assignment', an identifier property which is a string,
 * and a value property which is an ArgumentsType.
 */
export type PropertyAssignmentType = {
  type: "property_assignment";
  identifier: string;
  value: ArgumentsType;
};

/**
 * Represents a string literal in LangChain. It has a type property set to
 * 'string_literal' and a value property which is a string.
 */
export type StringLiteralType = {
  type: "string_literal";
  value: string;
};

/**
 * Represents an identifier in LangChain. It has a type property set to
 * 'identifier' and a value property which is a string.
 */
export type IdentifierType = {
  type: "identifier";
  value: string;
};

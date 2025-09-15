import { JsonSchema7AnyType } from "./parsers/any.js";
import { JsonSchema7ArrayType } from "./parsers/array.js";
import { JsonSchema7BigintType } from "./parsers/bigint.js";
import { JsonSchema7BooleanType } from "./parsers/boolean.js";
import { JsonSchema7DateType } from "./parsers/date.js";
import { JsonSchema7EnumType } from "./parsers/enum.js";
import { JsonSchema7AllOfType } from "./parsers/intersection.js";
import { JsonSchema7LiteralType } from "./parsers/literal.js";
import { JsonSchema7MapType } from "./parsers/map.js";
import { JsonSchema7NativeEnumType } from "./parsers/nativeEnum.js";
import { JsonSchema7NeverType } from "./parsers/never.js";
import { JsonSchema7NullType } from "./parsers/null.js";
import { JsonSchema7NullableType } from "./parsers/nullable.js";
import { JsonSchema7NumberType } from "./parsers/number.js";
import { JsonSchema7ObjectType } from "./parsers/object.js";
import { JsonSchema7RecordType } from "./parsers/record.js";
import { JsonSchema7SetType } from "./parsers/set.js";
import { JsonSchema7StringType } from "./parsers/string.js";
import { JsonSchema7TupleType } from "./parsers/tuple.js";
import { JsonSchema7UndefinedType } from "./parsers/undefined.js";
import { JsonSchema7UnionType } from "./parsers/union.js";
import { JsonSchema7UnknownType } from "./parsers/unknown.js";

type JsonSchema7RefType = { $ref: string };
type JsonSchema7Meta = {
  title?: string;
  default?: any;
  description?: string;
  markdownDescription?: string;
};

export type JsonSchema7TypeUnion =
  | JsonSchema7StringType
  | JsonSchema7ArrayType
  | JsonSchema7NumberType
  | JsonSchema7BigintType
  | JsonSchema7BooleanType
  | JsonSchema7DateType
  | JsonSchema7EnumType
  | JsonSchema7LiteralType
  | JsonSchema7NativeEnumType
  | JsonSchema7NullType
  | JsonSchema7NumberType
  | JsonSchema7ObjectType
  | JsonSchema7RecordType
  | JsonSchema7TupleType
  | JsonSchema7UnionType
  | JsonSchema7UndefinedType
  | JsonSchema7RefType
  | JsonSchema7NeverType
  | JsonSchema7MapType
  | JsonSchema7AnyType
  | JsonSchema7NullableType
  | JsonSchema7AllOfType
  | JsonSchema7UnknownType
  | JsonSchema7SetType;

export type JsonSchema7Type = JsonSchema7TypeUnion & JsonSchema7Meta;

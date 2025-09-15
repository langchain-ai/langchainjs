import { ZodTupleDef, ZodTupleItems, ZodTypeAny } from "zod/v3";
import { parseDef } from "../parseDef.js";
import { JsonSchema7Type } from "../parseTypes.js";
import { Refs } from "../Refs.js";

export type JsonSchema7TupleType = {
  type: "array";
  minItems: number;
  items: JsonSchema7Type[];
} & (
  | {
      maxItems: number;
    }
  | {
      additionalItems?: JsonSchema7Type;
    }
);

export function parseTupleDef(
  def: ZodTupleDef<ZodTupleItems | [], ZodTypeAny | null>,
  refs: Refs
): JsonSchema7TupleType {
  if (def.rest) {
    return {
      type: "array",
      minItems: def.items.length,
      items: def.items
        .map((x, i) =>
          parseDef(x._def, {
            ...refs,
            currentPath: [...refs.currentPath, "items", `${i}`],
          })
        )
        .reduce(
          (acc: JsonSchema7Type[], x) => (x === undefined ? acc : [...acc, x]),
          []
        ),
      additionalItems: parseDef(def.rest._def, {
        ...refs,
        currentPath: [...refs.currentPath, "additionalItems"],
      }),
    };
  } else {
    return {
      type: "array",
      minItems: def.items.length,
      maxItems: def.items.length,
      items: def.items
        .map((x, i) =>
          parseDef(x._def, {
            ...refs,
            currentPath: [...refs.currentPath, "items", `${i}`],
          })
        )
        .reduce(
          (acc: JsonSchema7Type[], x) => (x === undefined ? acc : [...acc, x]),
          []
        ),
    };
  }
}

import { ZodReadonlyDef } from "zod/v3";
import { parseDef } from "../parseDef.js";
import { Refs } from "../Refs.js";

export const parseReadonlyDef = (def: ZodReadonlyDef<any>, refs: Refs) => {
  return parseDef(def.innerType._def, refs);
};

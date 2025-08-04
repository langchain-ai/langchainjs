import {
  InteropZodObject,
  InteropZodType,
  InteropZodObjectShape,
} from "@langchain/core/utils/types";
import { BaseChannel } from "@langchain/langgraph";

export const META_EXTRAS_DESCRIPTION_PREFIX = "lg:";

/** @internal */
export type ReducedZodChannel<
  T extends InteropZodType,
  TReducerSchema extends InteropZodType
> = T & {
  lg_reducer_schema: TReducerSchema;
};

/** @internal */
export type InteropZodToStateDefinition<
  T extends InteropZodObject,
  TShape = InteropZodObjectShape<T>
> = {
  [key in keyof TShape]: TShape[key] extends ReducedZodChannel<
    infer Schema,
    infer ReducerSchema
  >
    ? Schema extends InteropZodType<infer V>
      ? ReducerSchema extends InteropZodType<infer U>
        ? BaseChannel<V, U>
        : never
      : never
    : TShape[key] extends InteropZodType<infer V, infer U>
    ? BaseChannel<V, U>
    : never;
};

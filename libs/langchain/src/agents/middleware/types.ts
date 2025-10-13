/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  InteropZodObject,
  InferInteropZodInput,
} from "@langchain/core/utils/types";
import type { AnnotationRoot } from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";

export type AnyAnnotationRoot = AnnotationRoot<any>;

/**
 * Helper type to extract input type from context schema (with optional defaults)
 */
export type InferContextInput<
  ContextSchema extends AnyAnnotationRoot | InteropZodObject
> = ContextSchema extends InteropZodObject
  ? InferInteropZodInput<ContextSchema>
  : ContextSchema extends AnyAnnotationRoot
  ? ToAnnotationRoot<ContextSchema>["State"]
  : {};

export type ToAnnotationRoot<A extends AnyAnnotationRoot | InteropZodObject> =
  A extends AnyAnnotationRoot
    ? A
    : A extends InteropZodObject
    ? AnnotationRoot<InteropZodToStateDefinition<A>>
    : never;

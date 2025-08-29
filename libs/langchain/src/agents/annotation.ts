import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  Messages,
  AnnotationRoot,
  messagesStateReducer,
  type BinaryOperatorAggregate,
} from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import type { InteropZodObject } from "@langchain/core/utils/types";
import type { ResponseFormatUndefined } from "./responses.js";

export const PreHookAnnotation: AnnotationRoot<{
  llmInputMessages: BinaryOperatorAggregate<BaseMessage[], Messages>;
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
}> = Annotation.Root({
  llmInputMessages: Annotation<BaseMessage[], Messages>({
    reducer: (_, update) => messagesStateReducer([], update),
    default: () => [],
  }),
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});
export type PreHookAnnotation = typeof PreHookAnnotation;

// Base annotation without structuredResponse (for ResponseFormatUndefined)
export const createReactAgentBaseAnnotation = () =>
  Annotation.Root({
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  });

// Full annotation with structuredResponse (for regular cases)
const createReactAgentAnnotation = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
>(): AnyAnnotationRoot =>
  Annotation.Root({
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    structuredResponse: Annotation<T>,
  });

// Create annotation conditionally - for ResponseFormatUndefined, don't include structuredResponse
export function createReactAgentAnnotationConditional<
  T extends Record<string, any> | ResponseFormatUndefined
>(hasStructuredResponse = true): AnyAnnotationRoot {
  const baseAnnotation = {
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  };

  if (!hasStructuredResponse) {
    return Annotation.Root(baseAnnotation);
  }

  return Annotation.Root({
    ...baseAnnotation,
    structuredResponse:
      Annotation<T extends ResponseFormatUndefined ? never : T>(),
  });
}

// Helper type to select the right annotation based on the response format type
export type ReactAgentAnnotation<
  T extends Record<string, any> | ResponseFormatUndefined
> = T extends ResponseFormatUndefined
  ? ReturnType<typeof createReactAgentBaseAnnotation>
  : T extends Record<string, any>
  ? ReturnType<typeof createReactAgentAnnotation<T>>
  : never;

export type ToAnnotationRoot<A extends AnyAnnotationRoot | InteropZodObject> =
  A extends AnyAnnotationRoot
    ? A
    : A extends InteropZodObject
    ? AnnotationRoot<InteropZodToStateDefinition<A>>
    : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAnnotationRoot = AnnotationRoot<any>;

/**
 * Enhances a state schema to ensure proper message handling.
 * If a Zod schema is provided, it creates an annotation that includes the messagesStateReducer
 * and infers appropriate reducers for all other fields.
 *
 * @param stateSchema - The state schema to enhance.
 * @returns The enhanced state schema.
 */
export function enhanceStateSchemaWithMessageReducer(
  stateSchema: AnyAnnotationRoot | InteropZodObject
): AnyAnnotationRoot {
  // If it's already an annotation, return as-is
  if (typeof stateSchema === "object" && "State" in stateSchema) {
    return stateSchema as AnyAnnotationRoot;
  }

  // If it's a Zod schema, create annotations for all fields
  if (
    typeof stateSchema === "object" &&
    "_def" in stateSchema &&
    "shape" in stateSchema._def
  ) {
    const shape =
      typeof stateSchema._def.shape === "function"
        ? stateSchema._def.shape()
        : stateSchema._def.shape;
    const annotationFields: Record<string, any> = {};

    /**
     * Process each field in the Zod schema
     */
    for (const [key, zodType] of Object.entries(shape)) {
      if (key === "messages") {
        /**
         * Special handling for messages field - always use messagesStateReducer
         */
        annotationFields[key] = Annotation<BaseMessage[]>({
          reducer: messagesStateReducer,
          default: () => [],
        });
      } else {
        /**
         * For other fields, create appropriate annotations based on type
         */
        annotationFields[key] = createAnnotationForZodType(zodType as any);
      }
    }

    /**
     * Ensure messages field exists even if not in the Zod schema
     */
    if (!annotationFields.messages) {
      annotationFields.messages = Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
      });
    }

    return Annotation.Root(annotationFields);
  }

  // Fallback: create a base annotation with message reducer only
  return Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  });
}

/**
 * Type configuration for different Zod types
 */
const ZOD_TYPE_CONFIGS = {
  ZodString: {
    reducer: (_: any, update: any) => update,
    fallbackDefault: "",
  },
  ZodNumber: {
    reducer: (_: any, update: any) => update,
    fallbackDefault: 0,
  },
  ZodBoolean: {
    reducer: (_: any, update: any) => update,
    fallbackDefault: false,
  },
  ZodArray: {
    reducer: (_: any, update: any) => update,
    fallbackDefault: [] as any[],
  },
  ZodRecord: {
    reducer: (current: any, update: any) => ({ ...current, ...update }),
    fallbackDefault: {} as Record<string, any>,
  },
  ZodObject: {
    reducer: (current: any, update: any) => ({ ...current, ...update }),
    fallbackDefault: {} as Record<string, any>,
  },
} as const;

/**
 * Creates an annotation based on type configuration and default value
 */
function createAnnotationFromConfig(
  config: (typeof ZOD_TYPE_CONFIGS)[keyof typeof ZOD_TYPE_CONFIGS],
  defaultValueFn: () => any
) {
  return Annotation<any>({
    reducer: config.reducer,
    default: defaultValueFn,
  });
}

/**
 * Creates an appropriate annotation for a given Zod type.
 */
function createAnnotationForZodType(zodType: any): any {
  const typeName = zodType._def?.typeName;

  // Handle ZodDefault wrapper first
  if (typeName === "ZodDefault") {
    const innerTypeName = zodType._def.innerType._def?.typeName;
    const config =
      ZOD_TYPE_CONFIGS[innerTypeName as keyof typeof ZOD_TYPE_CONFIGS];
    return config
      ? createAnnotationFromConfig(config, () => zodType._def.defaultValue())
      : Annotation<any>({
          reducer: (_: any, update: any) => update,
          default: () => zodType._def.defaultValue(),
        });
  }

  // Handle wrapper types that need recursion
  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    const innerAnnotation = createAnnotationForZodType(zodType._def.innerType);
    const hasDefault = zodType._def?.defaultValue !== undefined;
    const fallbackDefault = typeName === "ZodNullable" ? null : undefined;

    return {
      ...innerAnnotation,
      default: () =>
        hasDefault ? zodType._def.defaultValue() : fallbackDefault,
    };
  }

  // Handle regular types
  const config = ZOD_TYPE_CONFIGS[typeName as keyof typeof ZOD_TYPE_CONFIGS];
  if (config) {
    const hasDefault = zodType._def?.defaultValue !== undefined;
    const defaultValueFn = hasDefault
      ? () => zodType._def.defaultValue()
      : () => config.fallbackDefault;

    return createAnnotationFromConfig(config, defaultValueFn);
  }

  // Fallback for unknown types
  const hasDefault = zodType._def?.defaultValue !== undefined;
  return Annotation<any>({
    reducer: (_: any, update: any) => update,
    default: () => (hasDefault ? zodType._def.defaultValue() : undefined),
  });
}

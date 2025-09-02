import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  Messages,
  AnnotationRoot,
  messagesStateReducer,
  type BinaryOperatorAggregate,
  type LastValue,
} from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import {
  isInteropZodSchema,
  getInteropZodObjectShape,
  getInteropZodDefaultGetter,
  type InteropZodObject,
} from "@langchain/core/utils/types";
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
>(): AnnotationRoot<{
  structuredResponse: LastValue<T>;
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
}> =>
  Annotation.Root({
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    structuredResponse: Annotation<T>(),
  });

// Create annotation conditionally - for ResponseFormatUndefined, don't include structuredResponse
export function createReactAgentAnnotationConditional<
  T extends Record<string, any> | ResponseFormatUndefined
>(
  hasStructuredResponse = true
): AnnotationRoot<{
  structuredResponse: LastValue<T extends ResponseFormatUndefined ? never : T>;
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
}> {
  const baseAnnotation = {
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  };

  if (!hasStructuredResponse) {
    return Annotation.Root(baseAnnotation) as AnnotationRoot<{
      structuredResponse: LastValue<
        T extends ResponseFormatUndefined ? never : T
      >;
      messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
    }>;
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
) {
  /**
   * If it's already an annotation, return as-is
   */
  if (typeof stateSchema === "object" && "State" in stateSchema) {
    return stateSchema;
  }

  /**
   * If it's a Zod schema, create annotations for all fields
   */
  if (isInteropZodSchema(stateSchema)) {
    const shape = getInteropZodObjectShape(stateSchema);
    const annotationFields: Record<string, any> = {};

    /**
     * Process each field in the Zod schema
     */
    for (const [key, zodType] of Object.entries(shape)) {
      annotationFields[key] =
        key === "messages"
          ? /**
             * Special handling for messages field - always use messagesStateReducer
             */
            Annotation<BaseMessage[]>({
              reducer: messagesStateReducer,
              default: () => [],
            })
          : /**
             * For other fields, create appropriate annotations based on type
             */
            createAnnotationForZodType(zodType);
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

  /**
   * Fallback: create a base annotation with message reducer only
   */
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
    reducer: (_: unknown, update: unknown) => update,
    fallbackDefault: "",
  },
  ZodNumber: {
    reducer: (_: unknown, update: unknown) => update,
    fallbackDefault: 0,
  },
  ZodBoolean: {
    reducer: (_: unknown, update: unknown) => update,
    fallbackDefault: false,
  },
  ZodArray: {
    reducer: (_: unknown, update: unknown) => update,
    fallbackDefault: [] as unknown[],
  },
  ZodRecord: {
    reducer: (current: unknown[], update: unknown[]) => ({
      ...current,
      ...update,
    }),
    fallbackDefault: {} as Record<string, unknown>,
  },
  ZodObject: {
    reducer: (current: unknown[], update: unknown[]) => ({
      ...current,
      ...update,
    }),
    fallbackDefault: {} as Record<string, unknown>,
  },
} as const;

/**
 * Creates an annotation based on type configuration and default value
 */
function createAnnotationFromConfig(
  config: (typeof ZOD_TYPE_CONFIGS)[keyof typeof ZOD_TYPE_CONFIGS],
  defaultValueFn: () => unknown
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
  const defaultGetter = getInteropZodDefaultGetter(zodType);
  const isOptional = typeName === "ZodOptional";

  /**
   * Handle Zod wrapper first
   */
  if (
    typeName === "ZodDefault" ||
    typeName === "ZodOptional" ||
    typeName === "ZodNullable"
  ) {
    const innerTypeName = zodType._def.innerType._def?.typeName;
    const config =
      ZOD_TYPE_CONFIGS[innerTypeName as keyof typeof ZOD_TYPE_CONFIGS];
    return config
      ? createAnnotationFromConfig(
          config,
          () =>
            defaultGetter?.() ||
            (isOptional ? undefined : config?.fallbackDefault)
        )
      : Annotation<unknown>({
          reducer: (_: unknown, update: unknown) => update,
          default: () => defaultGetter?.(),
        });
  }

  /**
   * Handle regular types
   */
  const config = ZOD_TYPE_CONFIGS[typeName as keyof typeof ZOD_TYPE_CONFIGS];
  if (config) {
    return createAnnotationFromConfig(
      config,
      () => defaultGetter?.() || config?.fallbackDefault
    );
  }

  /**
   * Fallback for unknown types
   */
  return Annotation<unknown>({
    reducer: (_: unknown, update: unknown) => update,
    default: () => defaultGetter?.(),
  });
}

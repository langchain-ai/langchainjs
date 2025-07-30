import type { ContentBlock as BaseContentBlock } from "./content/base.js";
import type { ContentBlock } from "./content/index.js";

export type $MessageType =
  | "ai"
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | (string & NonNullable<unknown>);

export interface $MessageComplex {
  readonly content: {
    [key: string]: BaseContentBlock | undefined;
  };
  readonly responseMetadata: {
    provider?: string;
    [key: string]: unknown;
  };
  readonly usageMetadata: {
    [key: string]: unknown;
  };
}

export type $MergeDiscriminatedUnion<
  A extends Record<Key, PropertyKey>,
  B extends Record<Key, PropertyKey>,
  Key extends PropertyKey = "type"
> = {
  [T in A[Key] | B[Key]]: [Extract<B, Record<Key, T>>] extends [never]
    ? Extract<A, Record<Key, T>>
    : Extract<B, Record<Key, T>>;
}[A[Key] | B[Key]];

export interface $MergeMessageComplex<
  A extends $MessageComplex,
  B extends $MessageComplex
> {
  content: {
    [K in keyof (A["content"] & B["content"])]: NonNullable<
      K extends keyof A["content"] & keyof B["content"]
        ? $MergeDiscriminatedUnion<
            NonNullable<A["content"][K]> & Record<"type", PropertyKey>,
            NonNullable<B["content"][K]> & Record<"type", PropertyKey>,
            "type"
          >
        : K extends keyof A["content"]
        ? A["content"][K]
        : B["content"][K]
    >;
  };
  responseMetadata: B["responseMetadata"];
  usageMetadata: B["usageMetadata"];
}

export interface $StandardMessageComplex {
  content: {
    user: ContentBlock.Types;
    ai: ContentBlock.Types;
    tool: ContentBlock.Types;
    system: ContentBlock.Types;
  };
  responseMetadata: {
    provider?: string;
    [key: string]: unknown;
  };
  usageMetadata: {
    [key: string]: unknown;
  };
}

export type $NormalizedMessageComplex<TComplex extends $MessageComplex> =
  TComplex extends $StandardMessageComplex
    ? TComplex
    : $MergeMessageComplex<$StandardMessageComplex, TComplex>;

// this works
export type BaseMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex,
  TRole extends keyof $NormalizedMessageComplex<TComplex>["content"] = keyof $NormalizedMessageComplex<TComplex>["content"]
> = {
  [TMessageType in TRole]: {
    type: TMessageType;
    content: Array<
      $NormalizedMessageComplex<TComplex>["content"][TMessageType]
    >;
    responseMetadata: TComplex["responseMetadata"];
    usageMetadata: TComplex["usageMetadata"];
  };
}[TRole];

export type AIMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<TComplex, "ai">;

export type HumanMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<TComplex, "user">;

export type SystemMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<TComplex, "system">;

export type ToolMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<TComplex, "tool">;

export function isMessageWithType(
  message: unknown
): message is { type: unknown } {
  return typeof message === "object" && message !== null && "type" in message;
}

export function isAIMessage(message: unknown): message is AIMessage {
  return isMessageWithType(message) && message.type === "ai";
}

export function isHumanMessage(message: unknown): message is HumanMessage {
  return isMessageWithType(message) && message.type === "user";
}

export function isSystemMessage(message: unknown): message is SystemMessage {
  return isMessageWithType(message) && message.type === "system";
}

export function isToolMessage(message: unknown): message is ToolMessage {
  return isMessageWithType(message) && message.type === "tool";
}

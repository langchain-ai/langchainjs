import type { StandardContentBlock } from "./content/index.js";

export type $MessageType =
  | "ai"
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | (string & NonNullable<unknown>);

export interface $MessageComplex {
  readonly content: {
    [key: string]: unknown;
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
    user: StandardContentBlock;
    ai: StandardContentBlock;
    tool: StandardContentBlock;
    system: StandardContentBlock;
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

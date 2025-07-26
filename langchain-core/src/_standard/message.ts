import { ContentBlock } from "./content/index.js";

export type $MessageType =
  | "ai"
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | (string & NonNullable<unknown>);

export interface $MessageComplex {
  readonly content: {
    [key: string]: ContentBlock | undefined;
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

export type $MergeMessageComplex<
  A extends $MessageComplex,
  B extends $MessageComplex
> = {
  content: {
    [K in keyof (A["content"] & B["content"])]: NonNullable<
      K extends keyof A["content"] & keyof B["content"]
        ? $MergeDiscriminatedUnion<
            NonNullable<A["content"][K]>,
            NonNullable<B["content"][K]>,
            "type"
          >
        : K extends keyof A["content"]
        ? A["content"][K]
        : B["content"][K]
    >;
  };
};

export interface $StandardMessageComplex extends $MessageComplex {
  content: {
    user: ContentBlock.Standard;
    assistant: ContentBlock.Standard;
    tool: ContentBlock.Standard;
    system: ContentBlock.Standard;
  };
  responseMetadata: {
    provider?: string;
    [key: string]: unknown;
  };
  usageMetadata: {
    [key: string]: unknown;
  };
}

type $NormalizedMessageComplex<TComplex extends $MessageComplex> =
  TComplex extends $StandardMessageComplex
    ? // hot path for perf reasons
      TComplex
    : $MergeMessageComplex<$StandardMessageComplex, TComplex>;

type $BaseMessageShape<
  TComplex extends $MessageComplex,
  TRole extends keyof TComplex["content"] = keyof TComplex["content"]
> = {
  [TMessageType in keyof TComplex["content"]]: {
    type: TMessageType;
    content: Array<TComplex["content"][TMessageType]>;
    responseMetadata: TComplex["responseMetadata"];
    usageMetadata: TComplex["usageMetadata"];
    // TBD: how do we source this from content blocks without having a getter? (since these are just normal interface types? maybe proxies?)
    // Also TBD: these need to be using the type from the message complex content (where the content block is defined with type="tool_call")
    // toolCalls?: ContentBlock.Tools.ToolCallContentBlock[];
  };
}[TRole];

type BaseMessage<
  TRole extends keyof $NormalizedMessageComplex<TComplex>["content"],
  TComplex extends $MessageComplex = $StandardMessageComplex
> = $BaseMessageShape<$NormalizedMessageComplex<TComplex>, TRole>;

export type AIMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<"ai", TComplex>;

export type HumanMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<"user", TComplex>;

export type SystemMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<"system", TComplex>;

export type ToolMessage<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = BaseMessage<"tool", TComplex>;

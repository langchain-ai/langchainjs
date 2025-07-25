import { ContentBlock } from "./content/index.js";

export type $MessageType =
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | (string & NonNullable<unknown>);

export interface $MessageComplex {
  readonly content: {
    [key: string]: (ContentBlock & { type: string }) | undefined;
  };
}

export type $Merge<T, U> = Omit<T, keyof U> & U;

export type $MergeDiscriminatedUnion<
  A extends Record<Key, PropertyKey>,
  B extends Record<Key, PropertyKey>,
  Key extends PropertyKey = "type"
> = {
  [T in A[Key] | B[Key]]: [Extract<B, Record<Key, T>>] extends [never]
    ? Extract<A, Record<Key, T>>
    : [Extract<A, Record<Key, T>>] extends [never]
    ? Extract<B, Record<Key, T>>
    : $Merge<Extract<A, Record<Key, T>>, Extract<B, Record<Key, T>>>;
}[A[Key] | B[Key]];

export type $MergeMessageComplex<
  A extends $MessageComplex,
  B extends $MessageComplex
> = {
  content: {
    [K in
      | keyof A["content"]
      | keyof B["content"]]: K extends keyof A["content"] & keyof B["content"]
      ? $MergeDiscriminatedUnion<
          NonNullable<A["content"][K]>,
          NonNullable<B["content"][K]>,
          "type"
        >
      : K extends keyof A["content"]
      ? A["content"][K]
      : K extends keyof B["content"]
      ? B["content"][K]
      : never;
  };
};

export interface $StandardMessageComplex extends $MessageComplex {
  content: {
    user: ContentBlock.Standard;
    assistant: ContentBlock.Standard;
    tool: ContentBlock.Standard;
    system: ContentBlock.Standard;
  };
}

export type Message<
  TComplex extends $MessageComplex = $StandardMessageComplex
> = {
  [TMessageType in keyof $MergeMessageComplex<
    $StandardMessageComplex,
    TComplex
  >["content"]]: {
    type: TMessageType;
    content: Array<
      $MergeMessageComplex<
        $StandardMessageComplex,
        TComplex
      >["content"][TMessageType]
    >;
  };
}[keyof $MergeMessageComplex<$StandardMessageComplex, TComplex>["content"]];

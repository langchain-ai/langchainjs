import {
  $InferMessageContent,
  $InferMessageProperty,
  $MessageStructure,
  $StandardMessageStructure,
  AIMessage,
} from "./message";

export interface AIMessageChunk<
  TStructure extends $MessageStructure = $StandardMessageStructure
> {
  id?: string;
  name?: string;
  content: Array<$InferMessageContent<TStructure, "ai">>;
  responseMetadata?: $InferMessageProperty<
    TStructure,
    "ai",
    "responseMetadata"
  >;
  usageMetadata?: $InferMessageProperty<TStructure, "ai", "usageMetadata">;
}

export class AIMessageChunk<
  TStructure extends $MessageStructure = $StandardMessageStructure
> {
  constructor(text: string);
  constructor(content: Array<$InferMessageContent<TStructure, "ai">>);
  constructor(params: AIMessageChunk<TStructure>);
  constructor(
    arg:
      | string
      | Array<$InferMessageContent<TStructure, "ai">>
      | AIMessageChunk<TStructure>
  ) {
    if (typeof arg === "string") {
      this.content = [
        { type: "text", text: arg } as $InferMessageContent<TStructure, "ai">,
      ];
    } else if (Array.isArray(arg)) {
      this.content = arg;
    } else {
      this.id = arg.id;
      this.name = arg.name;
      this.content = arg.content;
      this.responseMetadata = arg.responseMetadata;
      this.usageMetadata = arg.usageMetadata;
    }
  }

  concat(other: AIMessageChunk): AIMessageChunk<TStructure> {
    // TODO: Implement this
    return new AIMessageChunk({
      ...this,
      content: [...this.content, ...other.content],
    });
  }

  toMessage(): AIMessage<TStructure> {
    return new AIMessage(this);
  }
}

import { Serializable } from "./load/serializable.js";
import {
  type BaseMessage,
  HumanMessage,
  getBufferString,
} from "./messages/index.js";

export interface BasePromptValueInterface extends Serializable {
  toString(): string;

  toChatMessages(): BaseMessage[];
}

export interface StringPromptValueInterface extends BasePromptValueInterface {
  value: string;
}

export interface ChatPromptValueInterface extends BasePromptValueInterface {
  messages: BaseMessage[];
}

/**
 * Base PromptValue class. All prompt values should extend this class.
 */
export abstract class BasePromptValue
  extends Serializable
  implements BasePromptValueInterface
{
  abstract toString(): string;

  abstract toChatMessages(): BaseMessage[];
}

/**
 * Represents a prompt value as a string. It extends the BasePromptValue
 * class and overrides the toString and toChatMessages methods.
 */
export class StringPromptValue
  extends BasePromptValue
  implements StringPromptValueInterface
{
  static lc_name(): string {
    return "StringPromptValue";
  }

  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  value: string;

  constructor(value: string) {
    super({ value });
    this.value = value;
  }

  toString() {
    return this.value;
  }

  toChatMessages() {
    return [new HumanMessage(this.value)];
  }
}

/**
 * Interface for the fields of a ChatPromptValue.
 */
export interface ChatPromptValueFields {
  messages: BaseMessage[];
}

/**
 * Class that represents a chat prompt value. It extends the
 * BasePromptValue and includes an array of BaseMessage instances.
 */
export class ChatPromptValue
  extends BasePromptValue
  implements ChatPromptValueInterface
{
  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  static lc_name() {
    return "ChatPromptValue";
  }

  messages: BaseMessage[];

  constructor(messages: BaseMessage[]);

  constructor(fields: ChatPromptValueFields);

  constructor(fields: BaseMessage[] | ChatPromptValueFields) {
    if (Array.isArray(fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { messages: fields };
    }

    super(fields);
    this.messages = fields.messages;
  }

  toString() {
    return getBufferString(this.messages);
  }

  toChatMessages() {
    return this.messages;
  }
}

export type ImageContent = {
  /** Specifies the detail level of the image. */
  detail?: "auto" | "low" | "high";

  /** Either a URL of the image or the base64 encoded image data. */
  url: string;
};

export interface ImagePromptValueFields {
  imageUrl: ImageContent;
}

/**
 * Class that represents an image prompt value. It extends the
 * BasePromptValue and includes an ImageURL instance.
 */
export class ImagePromptValue extends BasePromptValue {
  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  static lc_name() {
    return "ImagePromptValue";
  }

  imageUrl: ImageContent;

  /** @ignore */
  value: string;

  constructor(fields: ImagePromptValueFields);

  constructor(fields: ImageContent);

  constructor(fields: ImageContent | ImagePromptValueFields) {
    if (!("imageUrl" in fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { imageUrl: fields };
    }

    super(fields);
    this.imageUrl = fields.imageUrl;
  }

  toString() {
    return this.imageUrl.url;
  }

  toChatMessages() {
    return [
      new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: {
              detail: this.imageUrl.detail,
              url: this.imageUrl.url,
            },
          },
        ],
      }),
    ];
  }
}

export interface GenericObjectPromptValueFields {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

/**
 * Class that represents a generic object prompt value.
 */
export class GenericObjectPromptValue extends BasePromptValue {
  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  static lc_name() {
    return "GenericObjectPromptValue";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;

  /** @ignore */
  value: string;


  constructor(fields: GenericObjectPromptValueFields) {
    super(fields);
    this.data = fields.data;
  }

  toString() {
    return JSON.stringify(this.data, null, 2)
  }

  toChatMessages() {
    return [
      new HumanMessage({
        content: [
          {
            type: "generic",
            data: this.data,
          },
        ],
      }),
    ];
  }
}
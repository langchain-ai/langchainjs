// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import type { BaseCallbackConfig } from "../callbacks/manager.js";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
  ChatMessage,
  type BaseMessageLike,
  coerceMessageLikeToMessage,
  isBaseMessage,
  MessageContent,
  MessageContentComplex,
} from "../messages/index.js";
import {
  type ChatPromptValueInterface,
  ChatPromptValue,
} from "../prompt_values.js";
import type { InputValues, PartialValues } from "../utils/types/index.js";
import { Runnable } from "../runnables/base.js";
import { BaseStringPromptTemplate } from "./string.js";
import {
  BasePromptTemplate,
  type BasePromptTemplateInput,
  type TypedPromptInputValues,
} from "./base.js";
import {
  PromptTemplate,
  type ParamsFromFString,
  PromptTemplateInput,
  ExtractedFStringParams,
} from "./prompt.js";
import { ImagePromptTemplate } from "./image.js";
import {
  ParsedTemplateNode,
  TemplateFormat,
  parseFString,
  parseMustache,
} from "./template.js";
import { addLangChainErrorFields } from "../errors/index.js";
import { DictPromptTemplate } from "./dict.js";

/**
 * Abstract class that serves as a base for creating message prompt
 * templates. It defines how to format messages for different roles in a
 * conversation.
 */
export abstract class BaseMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  RunOutput extends BaseMessage[] = BaseMessage[]
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain_core", "prompts", "chat"];

  lc_serializable = true;

  abstract inputVariables: Array<Extract<keyof RunInput, string>>;

  /**
   * Method that takes an object of TypedPromptInputValues and returns a
   * promise that resolves to an array of BaseMessage instances.
   * @param values Object of TypedPromptInputValues
   * @returns Formatted array of BaseMessages
   */
  abstract formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<RunOutput>;

  /**
   * Calls the formatMessages method with the provided input and options.
   * @param input Input for the formatMessages method
   * @param options Optional BaseCallbackConfig
   * @returns Formatted output messages
   */
  async invoke(
    input: RunInput,
    options?: BaseCallbackConfig
  ): Promise<RunOutput> {
    return this._callWithConfig(
      (input: RunInput) => this.formatMessages(input),
      input,
      { ...options, runType: "prompt" }
    );
  }
}

/**
 * Interface for the fields of a MessagePlaceholder.
 */
export interface MessagesPlaceholderFields<T extends string> {
  variableName: T;
  optional?: boolean;
}

/**
 * Class that represents a placeholder for messages in a chat prompt. It
 * extends the BaseMessagePromptTemplate.
 */
export class MessagesPlaceholder<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = any
  >
  extends BaseMessagePromptTemplate<RunInput>
  implements MessagesPlaceholderFields<Extract<keyof RunInput, string>>
{
  static lc_name() {
    return "MessagesPlaceholder";
  }

  variableName: Extract<keyof RunInput, string>;

  optional: boolean;

  constructor(variableName: Extract<keyof RunInput, string>);

  constructor(
    fields: MessagesPlaceholderFields<Extract<keyof RunInput, string>>
  );

  constructor(
    fields:
      | Extract<keyof RunInput, string>
      | MessagesPlaceholderFields<Extract<keyof RunInput, string>>
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign
      fields = { variableName: fields };
    }
    super(fields);
    this.variableName = fields.variableName;
    this.optional = fields.optional ?? false;
  }

  get inputVariables() {
    return [this.variableName];
  }

  async formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]> {
    const input = values[this.variableName];
    if (this.optional && !input) {
      return [];
    } else if (!input) {
      const error = new Error(
        `Field "${this.variableName}" in prompt uses a MessagesPlaceholder, which expects an array of BaseMessages as an input value. Received: undefined`
      );
      error.name = "InputFormatError";
      throw error;
    }

    let formattedMessages;
    try {
      if (Array.isArray(input)) {
        formattedMessages = input.map(coerceMessageLikeToMessage);
      } else {
        formattedMessages = [coerceMessageLikeToMessage(input)];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const readableInput =
        typeof input === "string" ? input : JSON.stringify(input, null, 2);
      const error = new Error(
        [
          `Field "${this.variableName}" in prompt uses a MessagesPlaceholder, which expects an array of BaseMessages or coerceable values as input.`,
          `Received value: ${readableInput}`,
          `Additional message: ${e.message}`,
        ].join("\n\n")
      );
      error.name = "InputFormatError";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).lc_error_code = e.lc_error_code;
      throw error;
    }

    return formattedMessages;
  }
}

/**
 * Interface for the fields of a MessageStringPromptTemplate.
 */
export interface MessageStringPromptTemplateFields<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends InputValues = any
> {
  prompt: BaseStringPromptTemplate<T, string>;
}

/**
 * Abstract class that serves as a base for creating message string prompt
 * templates. It extends the BaseMessagePromptTemplate.
 */
export abstract class BaseMessageStringPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessagePromptTemplate<RunInput> {
  prompt: BaseStringPromptTemplate<
    InputValues<Extract<keyof RunInput, string>>,
    string
  >;

  constructor(
    prompt: BaseStringPromptTemplate<
      InputValues<Extract<keyof RunInput, string>>
    >
  );

  constructor(
    fields: MessageStringPromptTemplateFields<
      InputValues<Extract<keyof RunInput, string>>
    >
  );

  constructor(
    fields:
      | MessageStringPromptTemplateFields<
          InputValues<Extract<keyof RunInput, string>>
        >
      | BaseStringPromptTemplate<
          InputValues<Extract<keyof RunInput, string>>,
          string
        >
  ) {
    if (!("prompt" in fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { prompt: fields };
    }
    super(fields);
    this.prompt = fields.prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage>;

  async formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]> {
    return [await this.format(values)];
  }
}

/**
 * Abstract class that serves as a base for creating chat prompt
 * templates. It extends the BasePromptTemplate.
 */
export abstract class BaseChatPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<
  RunInput,
  ChatPromptValueInterface,
  PartialVariableName
> {
  constructor(input: BasePromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
  }

  abstract formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]>;

  async format(values: TypedPromptInputValues<RunInput>): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<ChatPromptValueInterface> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

/**
 * Interface for the fields of a ChatMessagePromptTemplate.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ChatMessagePromptTemplateFields<T extends InputValues = any>
  extends MessageStringPromptTemplateFields<T> {
  role: string;
}

/**
 * Class that represents a chat message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
export class ChatMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessageStringPromptTemplate<RunInput> {
  static lc_name() {
    return "ChatMessagePromptTemplate";
  }

  role: string;

  constructor(
    prompt: BaseStringPromptTemplate<
      InputValues<Extract<keyof RunInput, string>>
    >,
    role: string
  );

  constructor(
    fields: ChatMessagePromptTemplateFields<
      InputValues<Extract<keyof RunInput, string>>
    >
  );

  constructor(
    fields:
      | ChatMessagePromptTemplateFields<
          InputValues<Extract<keyof RunInput, string>>
        >
      | BaseStringPromptTemplate<InputValues<Extract<keyof RunInput, string>>>,
    role?: string
  ) {
    if (!("prompt" in fields)) {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { prompt: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  async format(values: RunInput): Promise<BaseMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/ban-types
    RunInput extends InputValues = Symbol,
    T extends string = string
  >(template: T, role: string, options?: { templateFormat?: TemplateFormat }) {
    return new this(
      PromptTemplate.fromTemplate<RunInput, T>(template, {
        templateFormat: options?.templateFormat,
      }),
      role
    );
  }
}

interface _TextTemplateParam {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text?: string | Record<string, any>;
}

function isTextTemplateParam(param: unknown): param is _TextTemplateParam {
  if (param === null || typeof param !== "object" || Array.isArray(param)) {
    return false;
  }
  return (
    Object.keys(param).length === 1 &&
    "text" in param &&
    typeof param.text === "string"
  );
}

interface _ImageTemplateParam {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image_url?: string | Record<string, any>;
}

function isImageTemplateParam(param: unknown): param is _ImageTemplateParam {
  if (param === null || typeof param !== "object" || Array.isArray(param)) {
    return false;
  }
  return (
    "image_url" in param &&
    (typeof param.image_url === "string" ||
      (typeof param.image_url === "object" &&
        param.image_url !== null &&
        "url" in param.image_url &&
        typeof param.image_url.url === "string"))
  );
}

type MessageClass =
  | typeof HumanMessage
  | typeof AIMessage
  | typeof SystemMessage;

type ChatMessageClass = typeof ChatMessage;

interface _StringImageMessagePromptTemplateOptions<
  Format extends TemplateFormat = TemplateFormat
> extends Record<string, unknown> {
  templateFormat?: Format;
}

class _StringImageMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  RunOutput extends BaseMessage[] = BaseMessage[]
> extends BaseMessagePromptTemplate<RunInput, RunOutput> {
  lc_namespace = ["langchain_core", "prompts", "chat"];

  lc_serializable = true;

  inputVariables: Array<Extract<keyof RunInput, string>> = [];

  additionalOptions: _StringImageMessagePromptTemplateOptions = {};

  prompt:
    | BaseStringPromptTemplate<
        InputValues<Extract<keyof RunInput, string>>,
        string
      >
    | Array<
        | BaseStringPromptTemplate<
            InputValues<Extract<keyof RunInput, string>>,
            string
          >
        | ImagePromptTemplate<
            InputValues<Extract<keyof RunInput, string>>,
            string
          >
        | MessageStringPromptTemplateFields<
            InputValues<Extract<keyof RunInput, string>>
          >
        | DictPromptTemplate<InputValues<Extract<keyof RunInput, string>>>
      >;

  protected messageClass?: MessageClass;

  static _messageClass(): MessageClass {
    throw new Error(
      "Can not invoke _messageClass from inside _StringImageMessagePromptTemplate"
    );
  }

  // ChatMessage contains role field, others don't.
  // Because of this, we have a separate class property for ChatMessage.
  protected chatMessageClass?: ChatMessageClass;

  constructor(
    /** @TODO When we come up with a better way to type prompt templates, fix this */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: any,
    additionalOptions?: _StringImageMessagePromptTemplateOptions
  ) {
    if (!("prompt" in fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { prompt: fields };
    }
    super(fields);
    this.prompt = fields.prompt;
    if (Array.isArray(this.prompt)) {
      let inputVariables: Extract<keyof RunInput, string>[] = [];
      this.prompt.forEach((prompt) => {
        if ("inputVariables" in prompt) {
          inputVariables = inputVariables.concat(prompt.inputVariables);
        }
      });
      this.inputVariables = inputVariables;
    } else {
      this.inputVariables = this.prompt.inputVariables;
    }
    this.additionalOptions = additionalOptions ?? this.additionalOptions;
  }

  createMessage(content: MessageContent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constructor = this.constructor as any;
    if (constructor._messageClass()) {
      const MsgClass = constructor._messageClass();
      return new MsgClass({ content });
    } else if (constructor.chatMessageClass) {
      const MsgClass = constructor.chatMessageClass();
      // Assuming ChatMessage constructor also takes a content argument
      return new MsgClass({
        content,
        role: this.getRoleFromMessageClass(MsgClass.lc_name()),
      });
    } else {
      throw new Error("No message class defined");
    }
  }

  getRoleFromMessageClass(name: string) {
    switch (name) {
      case "HumanMessage":
        return "human";
      case "AIMessage":
        return "ai";
      case "SystemMessage":
        return "system";
      case "ChatMessage":
        return "chat";
      default:
        throw new Error("Invalid message class name");
    }
  }

  static fromTemplate(
    template:
      | string
      | Array<
          | string
          | _TextTemplateParam
          | _ImageTemplateParam
          | Record<string, unknown>
        >,
    additionalOptions?: _StringImageMessagePromptTemplateOptions
  ) {
    if (typeof template === "string") {
      return new this(PromptTemplate.fromTemplate(template, additionalOptions));
    }
    const prompt: Array<
      | PromptTemplate<InputValues>
      | ImagePromptTemplate<InputValues>
      | DictPromptTemplate
    > = [];
    for (const item of template) {
      // handle string cases
      if (typeof item === "string") {
        prompt.push(PromptTemplate.fromTemplate(item, additionalOptions));
      } else if (item === null) {
        // pass
      } else if (isTextTemplateParam(item)) {
        let text = "";
        if (typeof item.text === "string") {
          text = item.text ?? "";
        }

        const options = {
          ...additionalOptions,
          additionalContentFields: item,
        };
        prompt.push(PromptTemplate.fromTemplate(text, options));
      } else if (isImageTemplateParam(item)) {
        let imgTemplate = item.image_url ?? "";
        let imgTemplateObject: ImagePromptTemplate<InputValues>;
        let inputVariables: string[] = [];
        if (typeof imgTemplate === "string") {
          let parsedTemplate: ParsedTemplateNode[];
          if (additionalOptions?.templateFormat === "mustache") {
            parsedTemplate = parseMustache(imgTemplate);
          } else {
            parsedTemplate = parseFString(imgTemplate);
          }

          const variables = parsedTemplate.flatMap((item) =>
            item.type === "variable" ? [item.name] : []
          );

          if ((variables?.length ?? 0) > 0) {
            if (variables.length > 1) {
              throw new Error(
                `Only one format variable allowed per image template.\nGot: ${variables}\nFrom: ${imgTemplate}`
              );
            }
            inputVariables = [variables[0]];
          } else {
            inputVariables = [];
          }

          imgTemplate = { url: imgTemplate };
          imgTemplateObject = new ImagePromptTemplate<InputValues>({
            template: imgTemplate,
            inputVariables,
            templateFormat: additionalOptions?.templateFormat,
            additionalContentFields: item,
          });
        } else if (typeof imgTemplate === "object") {
          if ("url" in imgTemplate) {
            let parsedTemplate: ParsedTemplateNode[];
            if (additionalOptions?.templateFormat === "mustache") {
              parsedTemplate = parseMustache(imgTemplate.url);
            } else {
              parsedTemplate = parseFString(imgTemplate.url);
            }

            inputVariables = parsedTemplate.flatMap((item) =>
              item.type === "variable" ? [item.name] : []
            );
          } else {
            inputVariables = [];
          }
          imgTemplateObject = new ImagePromptTemplate<InputValues>({
            template: imgTemplate,
            inputVariables,
            templateFormat: additionalOptions?.templateFormat,
            additionalContentFields: item,
          });
        } else {
          throw new Error("Invalid image template");
        }
        prompt.push(imgTemplateObject);
      } else if (typeof item === "object") {
        prompt.push(
          new DictPromptTemplate({
            template: item,
            templateFormat: additionalOptions?.templateFormat,
          })
        );
      }
    }
    return new this({ prompt, additionalOptions });
  }

  async format(input: TypedPromptInputValues<RunInput>): Promise<BaseMessage> {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (this.prompt instanceof BaseStringPromptTemplate) {
      const text = await this.prompt.format(input);

      return this.createMessage(text);
    } else {
      const content: MessageContent = [];
      for (const prompt of this.prompt) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let inputs: Record<string, any> = {};
        if (!("inputVariables" in prompt)) {
          throw new Error(
            `Prompt ${prompt} does not have inputVariables defined.`
          );
        }
        for (const item of prompt.inputVariables) {
          if (!inputs) {
            inputs = { [item]: input[item] };
          }
          inputs = { ...inputs, [item]: input[item] };
        }
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (prompt instanceof BaseStringPromptTemplate) {
          const formatted = await prompt.format(
            inputs as TypedPromptInputValues<RunInput>
          );
          let additionalContentFields: MessageContentComplex | undefined;
          if ("additionalContentFields" in prompt) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            additionalContentFields = prompt.additionalContentFields as any;
          }
          if (formatted !== "") {
            content.push({
              ...additionalContentFields,
              type: "text",
              text: formatted,
            });
          }
          /** @TODO replace this */
          // eslint-disable-next-line no-instanceof/no-instanceof
        } else if (prompt instanceof ImagePromptTemplate) {
          const formatted = await prompt.format(
            inputs as TypedPromptInputValues<RunInput>
          );
          let additionalContentFields: MessageContentComplex | undefined;
          if ("additionalContentFields" in prompt) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            additionalContentFields = prompt.additionalContentFields as any;
          }
          content.push({
            ...additionalContentFields,
            type: "image_url",
            image_url: formatted,
          });
          // eslint-disable-next-line no-instanceof/no-instanceof
        } else if (prompt instanceof DictPromptTemplate) {
          const formatted = await prompt.format(
            inputs as TypedPromptInputValues<RunInput>
          );
          let additionalContentFields: MessageContentComplex | undefined;
          if ("additionalContentFields" in prompt) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            additionalContentFields = prompt.additionalContentFields as any;
          }
          content.push({
            ...additionalContentFields,
            ...formatted,
          });
        }
      }
      return this.createMessage(content);
    }
  }

  async formatMessages(values: RunInput): Promise<RunOutput> {
    return [await this.format(values)] as BaseMessage[] as RunOutput;
  }
}

/**
 * Class that represents a human message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 * @example
 * ```typescript
 * const message = HumanMessagePromptTemplate.fromTemplate("{text}");
 * const formatted = await message.format({ text: "Hello world!" });
 *
 * const chatPrompt = ChatPromptTemplate.fromMessages([message]);
 * const formattedChatPrompt = await chatPrompt.invoke({
 *   text: "Hello world!",
 * });
 * ```
 */
export class HumanMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends _StringImageMessagePromptTemplate<RunInput> {
  static _messageClass(): typeof HumanMessage {
    return HumanMessage;
  }

  static lc_name() {
    return "HumanMessagePromptTemplate";
  }
}

/**
 * Class that represents an AI message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
export class AIMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends _StringImageMessagePromptTemplate<RunInput> {
  static _messageClass(): typeof AIMessage {
    return AIMessage;
  }

  static lc_name() {
    return "AIMessagePromptTemplate";
  }
}

/**
 * Class that represents a system message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 * @example
 * ```typescript
 * const message = SystemMessagePromptTemplate.fromTemplate("{text}");
 * const formatted = await message.format({ text: "Hello world!" });
 *
 * const chatPrompt = ChatPromptTemplate.fromMessages([message]);
 * const formattedChatPrompt = await chatPrompt.invoke({
 *   text: "Hello world!",
 * });
 * ```
 */
export class SystemMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends _StringImageMessagePromptTemplate<RunInput> {
  static _messageClass(): typeof SystemMessage {
    return SystemMessage;
  }

  static lc_name() {
    return "SystemMessagePromptTemplate";
  }
}

/**
 * Interface for the input of a ChatPromptTemplate.
 */
export interface ChatPromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplateInput<RunInput, PartialVariableName> {
  /**
   * The prompt messages
   */
  promptMessages: Array<BaseMessagePromptTemplate | BaseMessage>;

  /**
   * Whether to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;

  /**
   * The formatting method to use on the prompt.
   * @default "f-string"
   */
  templateFormat?: TemplateFormat;
}

export type BaseMessagePromptTemplateLike =
  | BaseMessagePromptTemplate
  | BaseMessageLike;

function _isBaseMessagePromptTemplate(
  baseMessagePromptTemplateLike: BaseMessagePromptTemplateLike
): baseMessagePromptTemplateLike is BaseMessagePromptTemplate {
  return (
    typeof (baseMessagePromptTemplateLike as BaseMessagePromptTemplate)
      .formatMessages === "function"
  );
}

function _coerceMessagePromptTemplateLike<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  Extra extends Omit<
    ChatPromptTemplateInput<RunInput>,
    "inputVariables" | "promptMessages" | "partialVariables"
  > = Omit<
    ChatPromptTemplateInput<RunInput>,
    "inputVariables" | "promptMessages" | "partialVariables"
  >
>(
  messagePromptTemplateLike: BaseMessagePromptTemplateLike,
  extra?: Extra
): BaseMessagePromptTemplate | BaseMessage {
  if (
    _isBaseMessagePromptTemplate(messagePromptTemplateLike) ||
    isBaseMessage(messagePromptTemplateLike)
  ) {
    return messagePromptTemplateLike;
  }
  if (
    Array.isArray(messagePromptTemplateLike) &&
    messagePromptTemplateLike[0] === "placeholder"
  ) {
    const messageContent = messagePromptTemplateLike[1];
    if (
      extra?.templateFormat === "mustache" &&
      typeof messageContent === "string" &&
      messageContent.slice(0, 2) === "{{" &&
      messageContent.slice(-2) === "}}"
    ) {
      const variableName = messageContent.slice(2, -2);
      return new MessagesPlaceholder({ variableName, optional: true });
    } else if (
      typeof messageContent === "string" &&
      messageContent[0] === "{" &&
      messageContent[messageContent.length - 1] === "}"
    ) {
      const variableName = messageContent.slice(1, -1);
      return new MessagesPlaceholder({ variableName, optional: true });
    }
    throw new Error(
      `Invalid placeholder template for format ${
        extra?.templateFormat ?? `"f-string"`
      }: "${
        messagePromptTemplateLike[1]
      }". Expected a variable name surrounded by ${
        extra?.templateFormat === "mustache" ? "double" : "single"
      } curly braces.`
    );
  }
  const message = coerceMessageLikeToMessage(messagePromptTemplateLike);
  let templateData:
    | string
    | (
        | string
        | _TextTemplateParam
        | _ImageTemplateParam
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | Record<string, any>
      )[];

  if (typeof message.content === "string") {
    templateData = message.content;
  } else {
    // Assuming message.content is an array of complex objects, transform it.
    templateData = message.content.map((item) => {
      if ("text" in item) {
        return { ...item, text: item.text };
      } else if ("image_url" in item) {
        return { ...item, image_url: item.image_url };
      } else {
        return item;
      }
    });
  }

  if (message._getType() === "human") {
    return HumanMessagePromptTemplate.fromTemplate(templateData, extra);
  } else if (message._getType() === "ai") {
    return AIMessagePromptTemplate.fromTemplate(templateData, extra);
  } else if (message._getType() === "system") {
    return SystemMessagePromptTemplate.fromTemplate(templateData, extra);
  } else if (ChatMessage.isInstance(message)) {
    return ChatMessagePromptTemplate.fromTemplate(
      message.content as string,
      message.role,
      extra
    );
  } else {
    throw new Error(
      `Could not coerce message prompt template from input. Received message type: "${message._getType()}".`
    );
  }
}

function isMessagesPlaceholder(
  x: BaseMessagePromptTemplate | BaseMessage
): x is MessagesPlaceholder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (x.constructor as any).lc_name() === "MessagesPlaceholder";
}

/**
 * Class that represents a chat prompt. It extends the
 * BaseChatPromptTemplate and uses an array of BaseMessagePromptTemplate
 * instances to format a series of messages for a conversation.
 * @example
 * ```typescript
 * const message = SystemMessagePromptTemplate.fromTemplate("{text}");
 * const chatPrompt = ChatPromptTemplate.fromMessages([
 *   ["ai", "You are a helpful assistant."],
 *   message,
 * ]);
 * const formattedChatPrompt = await chatPrompt.invoke({
 *   text: "Hello world!",
 * });
 * ```
 */
export class ChatPromptTemplate<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends BaseChatPromptTemplate<RunInput, PartialVariableName>
  implements ChatPromptTemplateInput<RunInput, PartialVariableName>
{
  static lc_name() {
    return "ChatPromptTemplate";
  }

  get lc_aliases(): Record<string, string> {
    return {
      promptMessages: "messages",
    };
  }

  promptMessages: Array<BaseMessagePromptTemplate | BaseMessage>;

  validateTemplate = true;

  templateFormat: TemplateFormat = "f-string";

  constructor(input: ChatPromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
    // If input is mustache and validateTemplate is not defined, set it to false
    if (
      input.templateFormat === "mustache" &&
      input.validateTemplate === undefined
    ) {
      this.validateTemplate = false;
    }
    Object.assign(this, input);

    if (this.validateTemplate) {
      const inputVariablesMessages = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (promptMessage instanceof BaseMessage) continue;
        for (const inputVariable of promptMessage.inputVariables) {
          inputVariablesMessages.add(inputVariable);
        }
      }

      const totalInputVariables = this.inputVariables as string[];
      const inputVariablesInstance = new Set(
        this.partialVariables
          ? totalInputVariables.concat(Object.keys(this.partialVariables))
          : totalInputVariables
      );
      const difference = new Set(
        [...inputVariablesInstance].filter(
          (x) => !inputVariablesMessages.has(x)
        )
      );
      if (difference.size > 0) {
        throw new Error(
          `Input variables \`${[
            ...difference,
          ]}\` are not used in any of the prompt messages.`
        );
      }
      const otherDifference = new Set(
        [...inputVariablesMessages].filter(
          (x) => !inputVariablesInstance.has(x)
        )
      );
      if (otherDifference.size > 0) {
        throw new Error(
          `Input variables \`${[
            ...otherDifference,
          ]}\` are used in prompt messages but not in the prompt template.`
        );
      }
    }
  }

  _getPromptType(): "chat" {
    return "chat";
  }

  private async _parseImagePrompts(
    message: BaseMessage,
    inputValues: InputValues<
      PartialVariableName | Extract<keyof RunInput, string>
    >
  ): Promise<BaseMessage> {
    if (typeof message.content === "string") {
      return message;
    }
    const formattedMessageContent = await Promise.all(
      message.content.map(async (item) => {
        if (item.type !== "image_url") {
          return item;
        }

        let imageUrl = "";
        if (typeof item.image_url === "string") {
          imageUrl = item.image_url;
        } else {
          imageUrl = item.image_url.url;
        }

        const promptTemplatePlaceholder = PromptTemplate.fromTemplate(
          imageUrl,
          {
            templateFormat: this.templateFormat,
          }
        );
        const formattedUrl = await promptTemplatePlaceholder.format(
          inputValues
        );

        if (typeof item.image_url !== "string" && "url" in item.image_url) {
          // eslint-disable-next-line no-param-reassign
          item.image_url.url = formattedUrl;
        } else {
          // eslint-disable-next-line no-param-reassign
          item.image_url = formattedUrl;
        }
        return item;
      })
    );
    // eslint-disable-next-line no-param-reassign
    message.content = formattedMessageContent;
    return message;
  }

  async formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);
    let resultMessages: BaseMessage[] = [];

    for (const promptMessage of this.promptMessages) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (promptMessage instanceof BaseMessage) {
        resultMessages.push(
          await this._parseImagePrompts(promptMessage, allValues)
        );
      } else {
        let inputValues: InputValues;

        if (this.templateFormat === "mustache") {
          inputValues = { ...allValues };
        } else {
          inputValues = promptMessage.inputVariables.reduce(
            (acc, inputVariable) => {
              if (
                !(inputVariable in allValues) &&
                !(
                  isMessagesPlaceholder(promptMessage) && promptMessage.optional
                )
              ) {
                const error = addLangChainErrorFields(
                  new Error(
                    `Missing value for input variable \`${inputVariable.toString()}\``
                  ),
                  "INVALID_PROMPT_INPUT"
                );
                throw error;
              }
              acc[inputVariable] = allValues[inputVariable];
              return acc;
            },
            {} as InputValues
          );
        }
        const message = await promptMessage.formatMessages(inputValues);
        resultMessages = resultMessages.concat(message);
      }
    }
    return resultMessages;
  }

  async partial<NewPartialVariableName extends string>(
    values: PartialValues<NewPartialVariableName>
  ) {
    // This is implemented in a way it doesn't require making
    // BaseMessagePromptTemplate aware of .partial()
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>[];
    const newPartialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as PartialValues<PartialVariableName | NewPartialVariableName>;
    const promptDict = {
      ...this,
      inputVariables: newInputVariables,
      partialVariables: newPartialVariables,
    };
    return new ChatPromptTemplate<
      InputValues<
        Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>
      >
    >(promptDict);
  }

  /**
   * Load prompt template from a template f-string
   */
  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/ban-types
    RunInput extends InputValues = Symbol,
    T extends string = string
  >(
    template: T,
    options?: Omit<
      PromptTemplateInput<RunInput, string, "f-string">,
      "template" | "inputVariables"
    >
  ): ChatPromptTemplate<ExtractedFStringParams<T, RunInput>>;

  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/ban-types
    RunInput extends InputValues = Symbol,
    T extends string = string
  >(
    template: T,
    options?: Omit<
      PromptTemplateInput<RunInput, string>,
      "template" | "inputVariables"
    >
  ): ChatPromptTemplate<ExtractedFStringParams<T, RunInput>>;

  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/ban-types
    RunInput extends InputValues = Symbol,
    T extends string = string
  >(
    template: T,
    options?: Omit<
      PromptTemplateInput<RunInput, string, "mustache">,
      "template" | "inputVariables"
    >
  ): ChatPromptTemplate<InputValues>;

  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/ban-types
    RunInput extends InputValues = Symbol,
    T extends string = string
  >(
    template: T,
    options?: Omit<
      PromptTemplateInput<RunInput, string, TemplateFormat>,
      "template" | "inputVariables"
    >
  ): ChatPromptTemplate<ExtractedFStringParams<T, RunInput> | InputValues> {
    const prompt = PromptTemplate.fromTemplate(template, options);
    const humanTemplate = new HumanMessagePromptTemplate({ prompt });
    return this.fromMessages<
      // eslint-disable-next-line @typescript-eslint/ban-types
      RunInput extends Symbol ? ParamsFromFString<T> : RunInput
    >([humanTemplate]);
  }

  /**
   * Create a chat model-specific prompt from individual chat messages
   * or message-like tuples.
   * @param promptMessages Messages to be passed to the chat model
   * @returns A new ChatPromptTemplate
   */
  static fromMessages<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = any,
    Extra extends ChatPromptTemplateInput<RunInput> = ChatPromptTemplateInput<RunInput>
  >(
    promptMessages: (
      | ChatPromptTemplate<InputValues, string>
      | BaseMessagePromptTemplateLike
    )[],
    extra?: Omit<
      Extra,
      "inputVariables" | "promptMessages" | "partialVariables"
    >
  ): ChatPromptTemplate<RunInput> {
    const flattenedMessages = promptMessages.reduce(
      (acc: Array<BaseMessagePromptTemplate | BaseMessage>, promptMessage) =>
        acc.concat(
          // eslint-disable-next-line no-instanceof/no-instanceof
          promptMessage instanceof ChatPromptTemplate
            ? promptMessage.promptMessages
            : [
                _coerceMessagePromptTemplateLike<
                  RunInput,
                  Omit<
                    Extra,
                    "inputVariables" | "promptMessages" | "partialVariables"
                  >
                >(promptMessage, extra),
              ]
        ),
      []
    );
    const flattenedPartialVariables = promptMessages.reduce(
      (acc, promptMessage) =>
        // eslint-disable-next-line no-instanceof/no-instanceof
        promptMessage instanceof ChatPromptTemplate
          ? Object.assign(acc, promptMessage.partialVariables)
          : acc,
      Object.create(null) as PartialValues
    );
    const inputVariables = new Set<string>();
    for (const promptMessage of flattenedMessages) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (promptMessage instanceof BaseMessage) continue;
      for (const inputVariable of promptMessage.inputVariables) {
        if (inputVariable in flattenedPartialVariables) {
          continue;
        }
        inputVariables.add(inputVariable);
      }
    }
    return new this<RunInput>({
      ...extra,
      inputVariables: [...inputVariables] as Extract<keyof RunInput, string>[],
      promptMessages: flattenedMessages,
      partialVariables: flattenedPartialVariables,
      templateFormat: extra?.templateFormat,
    });
  }

  /** @deprecated Renamed to .fromMessages */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromPromptMessages<RunInput extends InputValues = any>(
    promptMessages: (
      | ChatPromptTemplate<InputValues, string>
      | BaseMessagePromptTemplateLike
    )[]
  ): ChatPromptTemplate<RunInput> {
    return this.fromMessages(promptMessages);
  }
}

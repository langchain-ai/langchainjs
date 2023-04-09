import {
  BasePromptTemplate,
  BaseStringPromptTemplate,
  BasePromptTemplateInput,
} from "./base.js";
import {
  AIChatMessage,
  BaseChatMessage,
  BasePromptValue,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../schema/index.js";
import { PromptTemplate } from "./prompt.js";
import {
  SerializedChatPromptTemplate,
  SerializedMessagePromptTemplate,
} from "./serde.js";

export abstract class BaseMessagePromptTemplate<
  K extends string = string,
  P extends string = string
> {
  abstract inputVariables: K[];

  abstract formatMessages(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage[]>;

  serialize(): SerializedMessagePromptTemplate {
    return {
      _type: this.constructor.name,
      ...JSON.parse(JSON.stringify(this)),
    };
  }
}

export class ChatPromptValue extends BasePromptValue {
  messages: BaseChatMessage[];

  constructor(messages: BaseChatMessage[]) {
    super();
    this.messages = messages;
  }

  toString() {
    return JSON.stringify(this.messages);
  }

  toChatMessages() {
    return this.messages;
  }
}

export class MessagesPlaceholder<
  K extends string = string,
  P extends string = string
> extends BaseMessagePromptTemplate<K, P> {
  variableName: K;

  constructor(variableName: K) {
    super();
    this.variableName = variableName;
  }

  get inputVariables() {
    return [this.variableName];
  }

  formatMessages(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseChatMessage[]);
  }
}

export abstract class BaseMessageStringPromptTemplate<
  K extends string,
  P extends string
> extends BaseMessagePromptTemplate<K, P> {
  prompt: BaseStringPromptTemplate<K, P>;

  protected constructor(prompt: BaseStringPromptTemplate<K, P>) {
    super();
    this.prompt = prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage>;

  async formatMessages(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage[]> {
    return [await this.format(values)];
  }
}

export abstract class BaseChatPromptTemplate<
  K extends string,
  P extends string
> extends BasePromptTemplate<K, P> {
  constructor(input: BasePromptTemplateInput<K, P>) {
    super(input);
  }

  abstract formatMessages(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage[]>;

  async format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BasePromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

export class ChatMessagePromptTemplate<
  K extends string,
  P extends string
> extends BaseMessageStringPromptTemplate<K, P> {
  role: string;

  async format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  constructor(prompt: BaseStringPromptTemplate<K, P>, role: string) {
    super(prompt);
    this.role = role;
  }

  static fromTemplate<K extends string, P extends string = never>(
    template: string,
    role: string
  ) {
    return new this(PromptTemplate.fromTemplate<K, P>(template), role);
  }
}

export class HumanMessagePromptTemplate<
  K extends string,
  P extends string
> extends BaseMessageStringPromptTemplate<K, P> {
  async format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage> {
    return new HumanChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<K, P>) {
    super(prompt);
  }

  static fromTemplate<K extends string = string, P extends string = string>(
    template: string
  ) {
    return new this(PromptTemplate.fromTemplate<K, P>(template));
  }
}

export class AIMessagePromptTemplate<
  K extends string,
  P extends string
> extends BaseMessageStringPromptTemplate<K, P> {
  async format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage> {
    return new AIChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<K, P>) {
    super(prompt);
  }

  static fromTemplate<K extends string, P extends string = never>(
    template: string
  ) {
    return new this(PromptTemplate.fromTemplate<K, P>(template));
  }
}

export class SystemMessagePromptTemplate<
  K extends string,
  P extends string
> extends BaseMessageStringPromptTemplate<K, P> {
  async format(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage> {
    return new SystemChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<K, P>) {
    super(prompt);
  }

  static fromTemplate<K extends string = string, P extends string = string>(
    template: string
  ) {
    return new this(PromptTemplate.fromTemplate<K, P>(template));
  }
}

export interface ChatPromptTemplateInput<K extends string, P extends string>
  extends BasePromptTemplateInput<K, P> {
  /**
   * The prompt messages
   */
  promptMessages: BaseMessagePromptTemplate<K, P>[];

  /**
   * Whether to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

export class ChatPromptTemplate<K extends string, P extends string>
  extends BaseChatPromptTemplate<K, P>
  implements ChatPromptTemplateInput<K, P>
{
  promptMessages: BaseMessagePromptTemplate<K, P>[];

  validateTemplate = true;

  constructor(input: ChatPromptTemplateInput<K, P>) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      const inputVariablesMessages = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        for (const inputVariable of promptMessage.inputVariables) {
          inputVariablesMessages.add(inputVariable);
        }
      }
      const inputVariablesInstance = new Set<string>(
        this.partialVariables
          ? (this.inputVariables as string[]).concat(
              Object.keys(this.partialVariables)
            )
          : this.inputVariables
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

  async formatMessages(
    values: Record<K, any> & Partial<Record<P, any>>
  ): Promise<BaseChatMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);

    let resultMessages: BaseChatMessage[] = [];
    for (const promptMessage of this.promptMessages) {
      const inputValues = {} as Record<K | P, any>;
      for (const inputVariable of promptMessage.inputVariables) {
        if (!(inputVariable in allValues)) {
          throw new Error(
            `Missing value for input variable \`${inputVariable}\``
          );
        }
        inputValues[inputVariable] = allValues[inputVariable];
      }
      const message = await promptMessage.formatMessages(inputValues);
      resultMessages = resultMessages.concat(message);
    }
    return resultMessages;
  }

  serialize(): SerializedChatPromptTemplate {
    if (this.outputParser !== undefined) {
      throw new Error(
        "ChatPromptTemplate cannot be serialized if outputParser is set"
      );
    }
    return {
      input_variables: this.inputVariables,
      prompt_messages: this.promptMessages.map((m) => m.serialize()),
    };
  }

  async partial<P2 extends string>(
    values: Record<P2, any>
  ): Promise<BasePromptTemplate<Exclude<K, P2>, P | P2>> {
    // This is implemented in a way it doesn't require making
    // BaseMessagePromptTemplate aware of .partial()
    const promptDict: ChatPromptTemplateInput<Exclude<K, P2>, P | P2> = {
      ...this,
    } as never;
    promptDict.inputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<K, P2>[];
    promptDict.partialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as Record<P | P2, any>;
    return new ChatPromptTemplate(promptDict);
  }

  static fromPromptMessages<
    K extends string = string,
    P extends string = string
  >(
    promptMessages: BaseMessagePromptTemplate<K, P>[]
  ): ChatPromptTemplate<K, P> {
    const inputVariables = new Set<K>();
    for (const promptMessage of promptMessages) {
      for (const inputVariable of promptMessage.inputVariables) {
        inputVariables.add(inputVariable);
      }
    }
    return new ChatPromptTemplate<K, P>({
      inputVariables: [...inputVariables],
      promptMessages,
    });
  }
}

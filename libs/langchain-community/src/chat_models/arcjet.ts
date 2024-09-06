import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type {
  ArcjetSensitiveInfoType, RedactOptions
} from "@arcjet/redact";
import {
  redact,
} from "@arcjet/redact";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseMessage } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";

type DetectSensitiveInfoEntities<T> = (tokens: string[]) => Array<ArcjetSensitiveInfoType | T | undefined>;
type ValidEntities<Detect> = Array<undefined extends Detect ? ArcjetSensitiveInfoType : Detect extends DetectSensitiveInfoEntities<infer CustomEntities> ? ArcjetSensitiveInfoType | CustomEntities : never>;

export interface ArcjetRedactOptions<Detect> extends BaseChatModelParams {
  chatModel: BaseChatModel;
  entities?: ValidEntities<Detect>;
  contextWindowSize?: number;
  detect?: Detect;
  replace?: (entity: ValidEntities<Detect>[number]) => string | undefined;
}

async function transformTextMessageAsync(message: BaseMessage, transformer: (text: string) => Promise<string>): Promise<BaseMessage> {
  if (typeof message.content === "string") {
    message.content = await transformer(message.content);
    return message;
  }

  const redactedContent = await Promise.all(message.content.map(async (m) => {
    if (m.type === "text") {
      return {
        ...m,
        text: await transformer(m.text),
      }
    } else {
      return Promise.resolve(m);
    }
  }));
  message.content = redactedContent;
  return message;
}

function transformTextMessage(message: BaseMessage, transformer: (text: string) => string): BaseMessage {
  if (typeof message.content === "string") {
    message.content = transformer(message.content);
    return message;
  }

  const redactedContent = message.content.map((m) => {
    if (m.type === "text") {
      return {
        ...m,
        text: transformer(m.text),
      }
    } else {
      return m;
    }
  });
  message.content = redactedContent;
  return message;
}

export class ArcjetRedact<const Detect extends DetectSensitiveInfoEntities<CustomEntities> | undefined, const CustomEntities extends string> extends BaseChatModel {
  static lc_name() {
    return "ArcjetRedact";
  }

  chatModel: BaseChatModel;

  entities?: ValidEntities<Detect>;

  contextWindowSize?: number;

  detect?: Detect;

  replace?: (entity: ValidEntities<Detect>[number]) => string | undefined;

  index: number;

  constructor(options: ArcjetRedactOptions<Detect>) {
    super(options);

    if (!options.chatModel) {
      throw new Error("Arcjet Redact requires an LLM to be provided");
    }

    if (options.entities && !Array.isArray(options.entities)) {
      throw new Error("entities must be an array");
    }

    if (options.entities && options.entities.find((e) => typeof e !== "string")) {
      throw new Error("entities must all be strings");
    }

    if (options.entities && options.entities.length === 0) {
      throw new Error("no entities configured for redaction");
    }

    if (options.contextWindowSize && typeof options.contextWindowSize !== "number") {
      throw new Error("contextWindowSize must be a number")
    }

    if (options.detect && typeof options.detect !== "function") {
      throw new Error("detect must be a function")
    }

    if (options.replace && typeof options.replace !== "function") {
      throw new Error("replace must be a function")
    }

    this.chatModel = options.chatModel;
    this.entities = options.entities;
    this.contextWindowSize = options.contextWindowSize;
    this.detect = options.detect;
    this.replace = options.replace;
    this.index = 0;
  }

  _createUniqueReplacement(entity: ValidEntities<Detect>[number]): string {
    const userReplacement = typeof this.replace !== "undefined" ? this.replace(entity) : undefined;
    if (typeof userReplacement !== "undefined") {
      return userReplacement;
    }

    this.index++;

    if (entity === "email") {
      return `<Redacted email #${this.index}>`;
    }

    if (entity === "phone-number") {
      return `<Redacted phone number #${this.index}>`;
    }

    if (entity === "ip-address") {
      return `<Redacted IP address #${this.index}>`;
    }

    if (entity === "credit-card-number") {
      return `<Redacted credit card number #${this.index}>`;
    }

    return `<Redacted ${entity} #${this.index}>`;
  }

  _llmType() {
    return "arcjet_redact";
  }

  async _generate(messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const ajOptions: RedactOptions<Detect> = {
      entities: this.entities,
      contextWindowSize: this.contextWindowSize,
      detect: this.detect,
      replace: this._createUniqueReplacement.bind(this),
    };

    const unredactors: Array<(message: string) => string> = [];
    const redacted = await Promise.all(messages.map(async (message) => {
      return await transformTextMessageAsync(message, async (message) => {
        const [redacted, unredact] = await redact(message, ajOptions);
        unredactors.push(unredact);
        return redacted;
      })
    }));

    const response = await this.chatModel._generate(redacted, options, runManager);

    return {
      ...response,
      generations: response.generations.map((resp) => {
        return {
          ...resp,
          message: transformTextMessage(resp.message, (message: string) => {
            for (const unredact of unredactors) {
              message = unredact(message)
            }
            return message;
          }),
        }
      }),
    }
  }
}

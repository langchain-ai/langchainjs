import {
  LLM,
  BaseLLM,
  type BaseLLMCallOptions,
} from "@langchain/core/language_models/llms";
import type { ArcjetSensitiveInfoType, RedactOptions } from "@arcjet/redact";

type DetectSensitiveInfoEntities<T> = (
  tokens: string[]
) => Array<ArcjetSensitiveInfoType | T | undefined>;
type ValidEntities<Detect> = Array<
  undefined extends Detect
    ? ArcjetSensitiveInfoType
    : Detect extends DetectSensitiveInfoEntities<infer CustomEntities>
      ? ArcjetSensitiveInfoType | CustomEntities
      : never
>;

export type { ArcjetSensitiveInfoType, RedactOptions };

export interface ArcjetRedactOptions<Detect> extends BaseLLMCallOptions {
  llm: BaseLLM;
  entities?: ValidEntities<Detect>;
  contextWindowSize?: number;
  detect?: Detect;
  replace?: (entity: ValidEntities<Detect>[number]) => string | undefined;
}

export class ArcjetRedact<
  Detect extends DetectSensitiveInfoEntities<CustomEntities> | undefined,
  CustomEntities extends string,
> extends LLM {
  static lc_name() {
    return "ArcjetRedact";
  }

  llm: BaseLLM;

  entities?: ValidEntities<Detect>;

  contextWindowSize?: number;

  detect?: Detect;

  replace?: (entity: ValidEntities<Detect>[number]) => string | undefined;

  constructor(options: ArcjetRedactOptions<Detect>) {
    super(options);

    if (options.entities && options.entities.length === 0) {
      throw new Error("no entities configured for redaction");
    }
    this.llm = options.llm;
    this.entities = options.entities;
    this.contextWindowSize = options.contextWindowSize;
    this.detect = options.detect;
    this.replace = options.replace;
  }

  _llmType() {
    return "arcjet_redact";
  }

  async _call(input: string, options?: BaseLLMCallOptions): Promise<string> {
    const ajOptions: RedactOptions<Detect> = {
      entities: this.entities,
      contextWindowSize: this.contextWindowSize,
      detect: this.detect,
      replace: this.replace,
    };

    const { redact } = await import("@arcjet/redact");
    const [redacted, unredact] = await redact(input, ajOptions);

    // Invoke the underlying LLM with the prompt and options
    const result = await this.llm.invoke(redacted, options);

    return unredact(result);
  }
}

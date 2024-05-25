import {
  LLM,
  BaseLLM,
  type BaseLLMParams,
} from "@langchain/core/language_models/llms";
import {
  GuardrailResponse,
  LayerupSecurity as LayerupSecuritySDK,
  LLMMessage,
} from "@layerup/layerup-security";

export interface LayerupSecurityOptions extends BaseLLMParams {
  llm: BaseLLM;
  layerupApiKey?: string;
  layerupApiBaseUrl?: string;
  promptGuardrails?: string[];
  responseGuardrails?: string[];
  mask?: boolean;
  metadata?: Record<string, unknown>;
  handlePromptGuardrailViolation?: (violation: GuardrailResponse) => LLMMessage;
  handleResponseGuardrailViolation?: (
    violation: GuardrailResponse
  ) => LLMMessage;
}

function defaultGuardrailViolationHandler(
  violation: GuardrailResponse
): LLMMessage {
  if (violation.canned_response) return violation.canned_response;

  const guardrailName = violation.offending_guardrail
    ? `Guardrail ${violation.offending_guardrail}`
    : "A guardrail";
  throw new Error(
    `${guardrailName} was violated without a proper guardrail violation handler.`
  );
}

export class LayerupSecurity extends LLM {
  static lc_name() {
    return "LayerupSecurity";
  }

  lc_serializable = true;

  llm: BaseLLM;

  layerupApiKey: string;

  layerupApiBaseUrl = "https://api.uselayerup.com/v1";

  promptGuardrails: string[] = [];

  responseGuardrails: string[] = [];

  mask = false;

  metadata: Record<string, unknown> = {};

  handlePromptGuardrailViolation: (violation: GuardrailResponse) => LLMMessage =
    defaultGuardrailViolationHandler;

  handleResponseGuardrailViolation: (
    violation: GuardrailResponse
  ) => LLMMessage = defaultGuardrailViolationHandler;

  private layerup: LayerupSecuritySDK;

  constructor(options: LayerupSecurityOptions) {
    super(options);

    if (!options.llm) {
      throw new Error("Layerup Security requires an LLM to be provided.");
    } else if (!options.layerupApiKey) {
      throw new Error("Layerup Security requires an API key to be provided.");
    }

    this.llm = options.llm;
    this.layerupApiKey = options.layerupApiKey;
    this.layerupApiBaseUrl =
      options.layerupApiBaseUrl || this.layerupApiBaseUrl;
    this.promptGuardrails = options.promptGuardrails || this.promptGuardrails;
    this.responseGuardrails =
      options.responseGuardrails || this.responseGuardrails;
    this.mask = options.mask || this.mask;
    this.metadata = options.metadata || this.metadata;
    this.handlePromptGuardrailViolation =
      options.handlePromptGuardrailViolation ||
      this.handlePromptGuardrailViolation;
    this.handleResponseGuardrailViolation =
      options.handleResponseGuardrailViolation ||
      this.handleResponseGuardrailViolation;

    this.layerup = new LayerupSecuritySDK({
      apiKey: this.layerupApiKey,
      baseURL: this.layerupApiBaseUrl,
    });
  }

  _llmType() {
    return "layerup_security";
  }

  async _call(input: string, options?: BaseLLMParams): Promise<string> {
    // Since LangChain LLMs only support string inputs, we will wrap each call to Layerup in a single-message
    // array of messages, then extract the string element when we need to access it.
    let messages: LLMMessage[] = [
      {
        role: "user",
        content: input,
      },
    ];
    let unmaskResponse;

    if (this.mask) {
      [messages, unmaskResponse] = await this.layerup.maskPrompt(
        messages,
        this.metadata
      );
    }

    if (this.promptGuardrails.length > 0) {
      const securityResponse = await this.layerup.executeGuardrails(
        this.promptGuardrails,
        messages,
        input,
        this.metadata
      );

      // If there is a guardrail violation, extract the canned response and reply with that instead
      if (!securityResponse.all_safe) {
        const replacedResponse: LLMMessage =
          this.handlePromptGuardrailViolation(securityResponse);
        return replacedResponse.content as string;
      }
    }

    // Invoke the underlying LLM with the prompt and options
    let result = await this.llm.invoke(messages[0].content as string, options);

    if (this.mask && unmaskResponse) {
      result = unmaskResponse(result);
    }

    // Add to messages array for response guardrail handler
    messages.push({
      role: "assistant",
      content: result,
    });

    if (this.responseGuardrails.length > 0) {
      const securityResponse = await this.layerup.executeGuardrails(
        this.responseGuardrails,
        messages,
        result,
        this.metadata
      );

      // If there is a guardrail violation, extract the canned response and reply with that instead
      if (!securityResponse.all_safe) {
        const replacedResponse: LLMMessage =
          this.handleResponseGuardrailViolation(securityResponse);
        return replacedResponse.content as string;
      }
    }

    return result;
  }
}

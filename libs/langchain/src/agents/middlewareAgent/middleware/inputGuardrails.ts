import { z } from "zod";
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import type { InferInteropZodInput } from "@langchain/core/utils/types";

import { createMiddleware } from "../middleware.js";
import { initChatModel } from "../../../chat_models/universal.js";

/**
 * Configuration for a PII detection rule
 */
export interface PIIRule {
  /** Name of the rule for identification */
  name: string;
  /** Description of what this rule detects */
  description: string;
  /** Regular expression pattern to match PII */
  pattern: RegExp;
  /** Replacement text for detected PII */
  replacement: string;
  /** Whether this rule is enabled by default */
  enabled?: boolean;
}

/**
 * Custom function for PII detection and replacement
 */
export type PIIDetectionFunction = (text: string) => Promise<string> | string;

/**
 * Prebuilt PII detection rules for common sensitive information
 */
export const DEFAULT_PII_RULES: PIIRule[] = [
  {
    name: "ssn",
    description: "US Social Security Numbers",
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    replacement: "[REDACTED_SSN]",
    enabled: true,
  },
  {
    name: "phone",
    description: "Phone numbers",
    pattern:
      /(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s][0-9]{3}[-.\s][0-9]{4}|(?:\+?1[-.\s]?)?\([0-9]{3}\)\s?[0-9]{3}[-.\s]?[0-9]{4}/g,
    replacement: "[REDACTED_PHONE]",
    enabled: true,
  },
  {
    name: "email",
    description: "Email addresses",
    pattern: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}\b/g,
    replacement: "[REDACTED_EMAIL]",
    enabled: true,
  },
  {
    name: "credit_card",
    description: "Credit card numbers",
    pattern:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    replacement: "[REDACTED_CREDIT_CARD]",
    enabled: true,
  },
  {
    name: "ip_address",
    description: "IP addresses",
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    replacement: "[REDACTED_IP]",
    enabled: true,
  },
  {
    name: "drivers_license",
    description: "US driver's license numbers (common patterns)",
    pattern: /\b[A-Z]{1,2}[0-9]{6,8}\b/g,
    replacement: "[REDACTED_DRIVERS_LICENSE]",
    enabled: true,
  },
  {
    name: "passport",
    description: "US passport numbers",
    pattern: /\b[0-9]{9}\b/g,
    replacement: "[REDACTED_PASSPORT]",
    enabled: false, // Disabled by default as it might catch other 9-digit numbers
  },
  {
    name: "bank_account",
    description: "Bank account numbers",
    pattern: /\b[0-9]{8,17}\b/g,
    replacement: "[REDACTED_BANK_ACCOUNT]",
    enabled: false, // Disabled by default as it might catch other long numbers
  },
];

/**
 * Configuration schema for the Input Guardrails middleware
 */
const contextSchema = z.object({
  /**
   * Array of PII detection rules to apply
   * @default DEFAULT_PII_RULES (with enabled rules only)
   */
  rules: z.array(z.custom<PIIRule>()).optional(),

  /**
   * Custom PII detection functions to run in addition to rules
   */
  customDetectors: z.array(z.custom<PIIDetectionFunction>()).optional(),

  /**
   * Chat model to use for AI-powered PII detection
   * When provided, the model will analyze text for PII that regex patterns might miss
   */
  model: z.string().or(z.custom<LanguageModelLike>()).optional(),

  /**
   * Whether to log detected PII types (not the actual PII content)
   * @default false
   */
  logDetections: z.boolean().default(false),

  /**
   * Custom prompt for AI-powered PII detection
   * @default A built-in prompt that instructs the model to identify and redact PII
   */
  systemPrompt: z.string().optional(),
});

export type InputGuardrailsMiddlewareConfig = InferInteropZodInput<
  typeof contextSchema
>;

/**
 * Default prompt for AI-powered PII detection
 */
const DEFAULT_AI_DETECTION_PROMPT = `You are a PII detection system. Your task is to identify and redact personally identifiable information (PII) from the given text.

Please identify and replace the following types of PII with appropriate redaction markers:
- Names of people: [REDACTED_NAME]
- Addresses: [REDACTED_ADDRESS]
- Social Security Numbers: [REDACTED_SSN]
- Phone numbers: [REDACTED_PHONE]
- Email addresses: [REDACTED_EMAIL]
- Credit card numbers: [REDACTED_CREDIT_CARD]
- Bank account numbers: [REDACTED_BANK_ACCOUNT]
- Driver's license numbers: [REDACTED_DRIVERS_LICENSE]
- Passport numbers: [REDACTED_PASSPORT]
- Any other sensitive personal information: [REDACTED_PII]

Return only the redacted text with no additional explanation or formatting.`;

/**
 * Apply PII detection rules to text
 */
async function applyPIIRules(text: string, rules: PIIRule[]): Promise<string> {
  let processedText = text;

  for (const rule of rules) {
    if (rule.enabled !== false) {
      processedText = processedText.replace(rule.pattern, rule.replacement);
    }
  }

  return processedText;
}

/**
 * Apply custom PII detection functions to text
 */
async function applyCustomDetectors(
  text: string,
  detectors: PIIDetectionFunction[]
): Promise<string> {
  if (detectors.length === 0) {
    return text;
  }

  /**
   * Apply detectors sequentially
   */
  let processedText = text;
  for (const detector of detectors) {
    processedText = await detector(processedText);
  }
  return processedText;
}

/**
 * Apply AI-powered PII detection using a chat model
 */
async function applyAIDetection(
  text: string,
  model: LanguageModelLike,
  prompt: string = DEFAULT_AI_DETECTION_PROMPT
): Promise<string> {
  try {
    const response = (await model.invoke([
      new SystemMessage(prompt),
      new HumanMessage(text),
    ])) as BaseMessage;

    return response.content as string;
  } catch (error) {
    console.warn("AI PII detection failed, returning original text:", error);
    return text;
  }
}

interface ProcessHumanMessageConfig {
  rules: PIIRule[];
  customDetectors: PIIDetectionFunction[];
  model?: string | LanguageModelLike;
  logDetections: boolean;
  systemPrompt: string;
}

/**
 * Process a single human message for PII detection and redaction
 */
async function processHumanMessage(
  message: HumanMessage,
  config: ProcessHumanMessageConfig
): Promise<HumanMessage> {
  if (typeof message.content !== "string") {
    /**
     * Skip non-string content (e.g., multimodal content)
     */
    return message;
  }

  let processedContent = message.content;
  const detectedTypes: string[] = [];

  /**
   * Apply regex-based PII rules
   */
  const enabledRules = config.rules.filter((rule) => rule.enabled !== false);
  if (enabledRules.length > 0) {
    const originalContent = processedContent;
    processedContent = await applyPIIRules(processedContent, enabledRules);

    /**
     * Track which types of PII were detected
     */
    if (config.logDetections && processedContent !== originalContent) {
      enabledRules.forEach((rule) => {
        if (rule.pattern.test(originalContent)) {
          detectedTypes.push(rule.name);
        }
      });
    }
  }

  /**
   * Apply custom detection functions
   */
  if (config.customDetectors && config.customDetectors.length > 0) {
    processedContent = await applyCustomDetectors(
      processedContent,
      config.customDetectors
    );
  }

  /**
   * Apply AI-powered detection
   */
  if (config.model) {
    const aiModel =
      typeof config.model === "string"
        ? await initChatModel(config.model)
        : config.model;
    processedContent = await applyAIDetection(
      processedContent,
      aiModel,
      config.systemPrompt
    );
  }

  /**
   * Log detected PII types if enabled
   */
  if (config.logDetections && detectedTypes.length > 0) {
    console.log(
      `Input Guardrails: Detected and redacted PII types: ${detectedTypes.join(
        ", "
      )}`
    );
  }

  /**
   * Return new message with processed content if changes were made
   */
  if (processedContent !== message.content) {
    return new HumanMessage({
      content: processedContent,
      id: message.id,
      name: message.name,
      additional_kwargs: message.additional_kwargs,
    });
  }

  return message;
}

/**
 * Creates a middleware that detects and redacts personally identifiable information (PII)
 * from human messages before they reach the model.
 *
 * This middleware executes during the `beforeModel` phase and processes human messages
 * through a configurable pipeline of detection methods. Each method operates sequentially
 * on the message content:
 *
 * 1. Regex-based pattern matching using configurable rules
 * 2. Custom detection functions (if provided)
 * 3. Language model-based detection (if a model is provided)
 *
 * ## Detection Methods
 *
 * Regex patterns match common PII formats (SSN, phone numbers, email addresses,
 * credit card numbers, IP addresses, driver's licenses, passports, bank accounts).
 * See {@link DEFAULT_PII_RULES} for the full list of built-in patterns.
 *
 * Custom detection functions receive the text content and return modified text with
 * sensitive information redacted. Functions are applied sequentially after regex rules.
 *
 * Model-based detection uses a chat model to identify PII that may not match
 * predefined patterns. This adds latency but can detect contextual PII such as names
 * and addresses.
 *
 * ## Limitations
 *
 * PII redaction occurs only in the middleware layer. Original PII will remain in:
 * - LangGraph state checkpoints
 * - Network traffic between client and server
 * - Logs or monitoring systems outside the middleware
 *
 * For comprehensive PII protection, implement client-side filtering before transmission
 * and ensure proper checkpoint storage configuration.
 *
 * @param options - Configuration options for the middleware
 * @param options.rules - Array of PII detection rules. Defaults to enabled rules from {@link DEFAULT_PII_RULES}
 * @param options.customDetectors - Custom PII detection functions applied after regex rules
 * @param options.model - Chat model instance or model identifier for AI-based PII detection
 * @param options.logDetections - If true, logs detected PII types to console (not the content itself). Default: false
 * @param options.systemPrompt - System prompt for model-based detection. Defaults to a prompt that identifies common PII types
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @example Basic usage with default rules
 * ```typescript
 * import { inputGuardrailsMiddleware, HumanMessage } from "langchain";
 * import { createAgent } from "langchain";
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4",
 *   middleware: [inputGuardrailsMiddleware()]
 * });
 *
 * // PII in user messages will be automatically redacted
 * const result = await agent.invoke({
 *   messages: [new HumanMessage("My SSN is 123-45-6789 and email is john@example.com")]
 * });
 * // Agent sees: "My SSN is [REDACTED_SSN] and email is [REDACTED_EMAIL]"
 * ```
 *
 * @example Custom rules and detection
 * ```typescript
 * import { inputGuardrailsMiddleware, DEFAULT_PII_RULES } from "langchain";
 *
 * const customRule = {
 *   name: "employee_id",
 *   description: "Employee ID numbers",
 *   pattern: /EMP-\d{6}/g,
 *   replacement: "[REDACTED_EMPLOYEE_ID]",
 *   enabled: true
 * };
 *
 * const customDetector = async (text: string) => {
 *   // Custom logic to detect and redact sensitive info
 *   return text.replace(/Project Codename: \w+/g, "Project Codename: [REDACTED]");
 * };
 *
 * const middleware = inputGuardrailsMiddleware({
 *   rules: [...DEFAULT_PII_RULES, customRule],
 *   customDetectors: [customDetector],
 *   logDetections: true
 * });
 * ```
 *
 * @example AI-powered detection
 * ```typescript
 * import { ChatOpenAI } from "@langchain/openai";
 * import { inputGuardrailsMiddleware } from "langchain";
 *
 * const piiDetectionModel = new ChatOpenAI({
 *   model: "gpt-3.5-turbo", // Use a cost-effective model for PII detection
 *   temperature: 0
 * });
 *
 * const middleware = inputGuardrailsMiddleware({
 *   model: piiDetectionModel,
 *   systemPrompt: "Identify and redact any personal information...",
 *   logDetections: true
 * });
 * ```
 *
 * @example Selective rule configuration
 * ```typescript
 * import { inputGuardrailsMiddleware, DEFAULT_PII_RULES } from "langchain";
 *
 * // Enable only specific rules
 * const rules = DEFAULT_PII_RULES.map(rule => ({
 *   ...rule,
 *   enabled: ["ssn", "email", "phone"].includes(rule.name)
 * }));
 *
 * const middleware = inputGuardrailsMiddleware({
 *   rules,
 * });
 * ```
 *
 * @see {@link DEFAULT_PII_RULES} for available built-in rules
 * @see {@link PIIRule} for rule configuration
 * @see {@link PIIDetectionFunction} for custom detector signature
 * @public
 */
export function inputGuardrailsMiddleware(
  options: InputGuardrailsMiddlewareConfig = {}
): ReturnType<typeof createMiddleware> {
  return createMiddleware({
    name: "InputGuardrailsMiddleware",
    contextSchema,
    stateSchema: z.object({
      /**
       * cached message IDs that have already been processed
       */
      _processedMessageIds: z.array(z.string()).default([]),
    }),
    beforeModel: async (state, runtime) => {
      /**
       * Merge options with context, following bigTool.ts pattern
       */
      const rules = runtime.context.rules ?? options.rules ?? DEFAULT_PII_RULES;
      const customDetectors =
        runtime.context.customDetectors ?? options.customDetectors ?? [];
      const model = runtime.context.model ?? options.model;
      const logDetections =
        runtime.context.logDetections === false
          ? options.logDetections ?? runtime.context.logDetections
          : runtime.context.logDetections ?? options.logDetections ?? false;
      const systemPrompt =
        runtime.context.systemPrompt ??
        options.systemPrompt ??
        DEFAULT_AI_DETECTION_PROMPT;

      const config: ProcessHumanMessageConfig = {
        rules,
        customDetectors,
        model,
        logDetections,
        systemPrompt,
      };

      /**
       * Process messages, focusing on HumanMessages
       */
      let hasChanges = false;
      const processedMessages = await Promise.all(
        state.messages.map(async (message) => {
          if (
            /**
             * only process HumanMessages that have not already been processed
             */
            !HumanMessage.isInstance(message) ||
            (message.id && state._processedMessageIds?.includes(message.id))
          ) {
            return message;
          }

          const processed = await processHumanMessage(message, config);
          if (processed !== message) {
            hasChanges = true;
            return processed;
          }
          return message;
        })
      );

      /**
       * Return updated state only if changes were made
       */
      if (hasChanges) {
        return {
          _processedMessageIds: [
            ...new Set([
              ...(state._processedMessageIds ?? []),
              ...processedMessages.map((message) => message.id as string),
            ]),
          ],
          messages: processedMessages,
        };
      }

      /**
       * No changes needed
       */
      return;
    },
  });
}

import type { OpenAI as OpenAIClient, ClientOptions } from "openai";
import {
  BaseDecisionModel,
  parseClassifierResponse,
  type Answer,
  type ClassifierResponse,
  type Content,
  type JsonValue,
  type Question,
  type State,
} from "@langchain/core/decisions";
import { ModelRefusalError } from "@langchain/core/errors";
import type { RunnableConfig } from "@langchain/core/runnables";
import { convertResponsesUsageToUsageMetadata } from "../converters/responses.js";
import { wrapOpenAIClientError } from "../utils/client.js";
import { createDecisionsClient } from "./client.js";
import { toDecisionInput } from "./input.js";
import type { DecisionInput } from "./types.js";

type QuestionParam = OpenAIClient.DecisionCreateParams["questions"][number];
type QuestionPart = Exclude<
  OpenAIClient.DecisionCreateParams.QuestionParamPredicate["instructions"],
  string
>[number];
type DecisionAnswer = OpenAIClient.Decision["answers"][number];

export interface OpenAIClassifierFields {
  /** Decisions model name, such as `gpt-6-luna`. */
  model: string;
  /**
   * OpenAI API key. Defaults to `OPENAI_API_KEY`, or the LangSmith gateway key when
   * requests are routed through the gateway.
   */
  apiKey?: string;
  /**
   * OpenAI SDK client options, such as `baseURL`, `timeout`, `maxRetries` or `fetch`.
   * Without a `baseURL`, `OPENAI_API_BASE` or `OPENAI_BASE_URL`, setting
   * `LANGSMITH_GATEWAY` routes requests through the LangSmith LLM gateway.
   */
  configuration?: Omit<ClientOptions, "apiKey">;
}

/**
 * Ask typed questions about text, messages or JSON state with the OpenAI Decisions
 * API (beta), through the provider-agnostic `BaseDecisionModel` interface.
 *
 * A single request can combine `noul` probabilities, `choice` selections and
 * `score` ratings over shared state. Answers keep their probabilities and
 * confidence, so the same code can switch between decision model providers. For the
 * native Decisions API question format, use `OpenAIDecisions`.
 *
 * - `noul` questions are sent as Decisions `predicate` questions. Predicates have no
 *   outcome descriptions, so `noul` criteria are appended to the instructions.
 * - A `choice` needs at least two labels, and `box` questions are not supported.
 * - The API answers each question or refuses it. If it refuses any question,
 *   `invoke` throws `ModelRefusalError`.
 * - Instructions may be text, image content blocks, or JSON, which is sent as an
 *   `input_json` part. Criteria must be text or JSON.
 *
 * @example
 * ```typescript
 * const classifier = new OpenAIClassifier({ model: "gpt-6-luna" });
 * const response = await classifier.invoke({
 *   state: "Stripe has failed to connect for three days. Help ASAP.",
 *   questions: {
 *     urgent: { type: "noul", instructions: "Is this request urgent?" },
 *     team: {
 *       type: "choice",
 *       instructions: "Which team should handle this request?",
 *       criteria: { billing: "Payments", technical: "Integrations" },
 *     },
 *   },
 * });
 * response.nouls.urgent.noul; // 0.93
 * response.choices.team.choice; // "technical"
 * ```
 */
export class OpenAIClassifier extends BaseDecisionModel {
  static lc_name() {
    return "OpenAIClassifier";
  }

  lc_namespace = ["langchain", "classifiers", "openai"];

  get lc_secrets(): Record<string, string> {
    return { apiKey: "OPENAI_API_KEY" };
  }

  protected client: OpenAIClient;

  constructor(model: string, fields?: Omit<OpenAIClassifierFields, "model">);
  constructor(fields: OpenAIClassifierFields);
  constructor(
    modelOrFields: string | OpenAIClassifierFields,
    fieldsArg?: Omit<OpenAIClassifierFields, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...fieldsArg, model: modelOrFields }
        : modelOrFields;
    if (!fields.model?.trim())
      throw new Error("An OpenAI Decisions model is required.");
    const { apiKey, ...kwargs } = fields;
    super(kwargs);
    this.client = createDecisionsClient(apiKey, fields.configuration);
  }

  get _provider(): string {
    return "openai";
  }

  async _classify(
    state: State,
    questions: Record<string, Question>,
    config?: Partial<RunnableConfig>
  ): Promise<ClassifierResponse> {
    const params = Object.entries(questions).map(([name, question]) =>
      toQuestionParam(name, question)
    );
    let decision: OpenAIClient.Decision;
    let response: Response;
    try {
      ({ data: decision, response } = await this.client.decisions
        .create(
          {
            model: this.model,
            input: toDecisionInput(state as DecisionInput),
            questions: params,
          },
          { signal: config?.signal }
        )
        .withResponse());
    } catch (error) {
      throw wrapOpenAIClientError(error);
    }
    const answers = new Map<string, DecisionAnswer>();
    for (const answer of decision.answers)
      if (answer.name != null) answers.set(answer.name, answer);
    const refused = Object.keys(questions).filter(
      (name) => answers.get(name)?.type === "refusal"
    );
    if (refused.length)
      throw new ModelRefusalError(
        `The OpenAI Decisions API refused to answer: ${refused.join(", ")}.`
      );
    const converted: Record<string, Answer> = {};
    for (const [name, question] of Object.entries(questions)) {
      const answer = answers.get(name);
      if (answer) converted[name] = toAnswer(question, answer);
    }
    return parseClassifierResponse({
      model: decision.model,
      answers: converted,
      usage_metadata: convertResponsesUsageToUsageMetadata(decision.usage),
      requestId: response.headers.get("x-request-id"),
    });
  }
}

/** Converts a decision model question to a Decisions API question. */
function toQuestionParam(name: string, question: Question): QuestionParam {
  if (question.type === "box")
    throw new Error(
      `Question "${name}": the OpenAI Decisions API does not support box questions.`
    );
  const instructions = toInstructions(question.instructions);
  if (question.type === "noul") {
    const criteria = [
      ["true", question.criteria?.true],
      ["false", question.criteria?.false],
    ]
      .filter(([, description]) => description != null)
      .map(
        ([outcome, description]) =>
          `Answer ${outcome} if: ${toText(description as JsonValue)}`
      )
      .join("\n");
    return {
      type: "predicate",
      name,
      instructions: criteria
        ? appendText(instructions, criteria)
        : instructions,
    };
  }
  if (question.type === "choice") {
    const labels = Object.entries(question.criteria);
    if (labels.length < 2)
      throw new Error(
        `Question "${name}": the OpenAI Decisions API requires at least two choice labels.`
      );
    return {
      type: "choice",
      name,
      instructions,
      choices: labels.map(([value, description]) =>
        description == null
          ? { value }
          : { value, description: toText(description) }
      ),
    };
  }
  return {
    type: "score",
    name,
    instructions,
    levels: question.criteria.map((level) => ({ label: toText(level) })),
  };
}

function toAnswer(question: Question, answer: DecisionAnswer): Answer {
  if (answer.type === "predicate")
    return { type: "noul", noul: answer.probability };
  if (answer.type === "choice")
    return {
      type: "choice",
      choice: String(answer.choice),
      confidence: answer.confidence,
      probabilities: Object.fromEntries(
        answer.probabilities.map(({ value, probability }) => [
          String(value),
          probability,
        ])
      ),
    };
  if (answer.type === "score")
    return {
      type: "score",
      score: answer.score,
      confidence: answer.confidence,
      legend: Object.fromEntries(
        (question.type === "score" ? question.criteria : []).map(
          (level, index) => [String(index), level]
        )
      ),
      probabilities: Object.fromEntries(
        answer.probabilities.map(({ value, probability }) => [
          String(value),
          probability,
        ])
      ),
    };
  throw new Error(`Unexpected OpenAI Decisions answer type "${answer.type}".`);
}

type Block = Record<string, unknown>;

function isBlock(value: unknown): value is Block {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns the URL of a LangChain image content block, or undefined for other values. */
function imageUrl(value: unknown): string | undefined {
  if (!isBlock(value)) return undefined;
  if (value.type === "image_url") {
    const image = value.image_url;
    if (typeof image === "string") return image;
    if (isBlock(image) && typeof image.url === "string") return image.url;
  }
  if (value.type === "image") {
    if (typeof value.url === "string") return value.url;
    const data = value.data ?? value.base64;
    const mimeType = value.mimeType ?? value.mime_type;
    if (typeof data === "string" && typeof mimeType === "string")
      return `data:${mimeType};base64,${data}`;
  }
  return undefined;
}

function isTextBlock(value: unknown): value is { type: "text"; text: string } {
  return (
    isBlock(value) && value.type === "text" && typeof value.text === "string"
  );
}

/**
 * Sends text as-is, image blocks and lists of text and image blocks as input parts,
 * JSON objects as `input_json` parts, and any other JSON as JSON text.
 */
function toInstructions(content: Content): QuestionParam["instructions"] {
  if (typeof content === "string") return content;
  const blocks = Array.isArray(content) ? content : [content];
  if (blocks.every((block) => isTextBlock(block) || imageUrl(block)))
    return blocks.map((block): QuestionPart =>
      isTextBlock(block)
        ? { type: "input_text", text: block.text }
        : { type: "input_image", image_url: imageUrl(block)! }
    );
  if (isBlock(content) || (blocks.length && blocks.every(isBlock)))
    return [
      {
        type: "input_json",
        data: content as OpenAIClient.DecisionInputJSON["data"],
      },
    ];
  return JSON.stringify(content);
}

function appendText(
  instructions: QuestionParam["instructions"],
  text: string
): QuestionParam["instructions"] {
  return typeof instructions === "string"
    ? `${instructions}\n\n${text}`
    : [...instructions, { type: "input_text", text }];
}

/** Returns text as-is and other JSON as JSON text. Criteria cannot carry images. */
function toText(content: JsonValue): string {
  if (typeof content === "string") return content;
  if (containsImage(content))
    throw new Error(
      "The OpenAI Decisions API accepts only text and JSON in question criteria."
    );
  return JSON.stringify(content);
}

function containsImage(value: unknown): boolean {
  if (imageUrl(value)) return true;
  if (Array.isArray(value)) return value.some(containsImage);
  if (isBlock(value)) return Object.values(value).some(containsImage);
  return false;
}

import type { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { Runnable } from "../runnables/base.js";
import {
  ensureConfig,
  patchConfig,
  type RunnableConfig,
} from "../runnables/config.js";
import {
  parseQuestions,
  type ClassifierRequest,
  type ClassifierResponse,
  type Question,
  type State,
} from "./types.js";

/** Fields shared by every decision model. */
export interface BaseDecisionModelFields {
  /** Provider model name used to answer questions. */
  model: string;
}

/**
 * Answer typed questions about text, messages, or structured state.
 *
 * A decision model evaluates shared state against one or more questions and
 * returns typed answers: a probability for a `Noul`, a selected label for a
 * `Choice`, an expected level for a `Score`, and a location for a `Box`.
 * Answers keep their probability distributions and confidence so applications
 * can choose their own thresholds.
 *
 * Subclasses implement `_classify` to call a provider. This class validates
 * questions and handles callbacks, tracing metadata, and token-usage
 * reporting.
 *
 * @example
 * ```ts
 * import {
 *   BaseDecisionModel,
 *   parseClassifierResponse,
 * } from "@langchain/core/decisions";
 *
 * class MyDecisionModel extends BaseDecisionModel {
 *   lc_namespace = ["my_provider", "decisions"];
 *
 *   get _provider() {
 *     return "my_provider";
 *   }
 *
 *   async _classify(
 *     state: State,
 *     questions: Record<string, Question>,
 *     config?: Partial<RunnableConfig>
 *   ) {
 *     const body = await myClient.classify(
 *       { model: this.model, state, questions },
 *       { signal: config?.signal }
 *     );
 *     return parseClassifierResponse(body);
 *   }
 * }
 * ```
 */
export abstract class BaseDecisionModel extends Runnable<
  ClassifierRequest,
  ClassifierResponse
> {
  readonly model: string;

  constructor(fields: BaseDecisionModelFields) {
    super(fields);
    this.model = fields.model;
  }

  /** Provider name reported to LangSmith as `ls_provider`. */
  abstract get _provider(): string;

  /**
   * Answer one request.
   *
   * @param state State to evaluate.
   * @param questions Validated questions keyed by answer ID.
   * @param config Runnable config, including the abort `signal`.
   * @returns Typed answers keyed by answer ID, with request metadata.
   */
  abstract _classify(
    state: State,
    questions: Record<string, Question>,
    config?: Partial<RunnableConfig>
  ): Promise<ClassifierResponse>;

  /**
   * Classify one request.
   *
   * The run is traced as an LLM run with `ls_provider` and `ls_model_name`
   * metadata, and its output carries `usage_metadata` when the provider reports
   * usage.
   *
   * @param input State and questions to evaluate.
   * @param options Callbacks, tags, metadata, and other runnable config.
   * @returns Typed answers keyed by answer ID, with request metadata.
   * @throws Error if a question is invalid or `questions` is empty.
   */
  async invoke(
    input: ClassifierRequest,
    options?: Partial<RunnableConfig>
  ): Promise<ClassifierResponse> {
    const config = ensureConfig(options);
    return this._callWithConfig(
      async (
        request: ClassifierRequest,
        runConfig?: Partial<RunnableConfig & { runType: string }>,
        runManager?: CallbackManagerForChainRun
      ) => {
        const { runType: _runType, ...childConfig } = runConfig ?? {};
        return this._classify(
          request.state,
          parseQuestions(request.questions),
          patchConfig(childConfig, { callbacks: runManager?.getChild() })
        );
      },
      input,
      {
        ...config,
        runType: "llm",
        metadata: {
          ...config.metadata,
          ls_provider: this._provider,
          ls_model_name: this.model,
          ls_model_type: "chat",
        },
      }
    );
  }
}

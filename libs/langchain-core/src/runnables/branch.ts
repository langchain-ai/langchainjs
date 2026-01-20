import {
  Runnable,
  RunnableLike,
  _coerceToDict,
  _coerceToRunnable,
} from "./base.js";
import {
  RunnableConfig,
  getCallbackManagerForConfig,
  patchConfig,
} from "./config.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { concat } from "../utils/stream.js";

/**
 * Type for a branch in the RunnableBranch. It consists of a condition
 * runnable and a branch runnable. The condition runnable is used to
 * determine whether the branch should be executed, and the branch runnable
 * is executed if the condition is true.
 */
export type Branch<RunInput, RunOutput> = [
  Runnable<RunInput, boolean>,
  Runnable<RunInput, RunOutput>
];

export type BranchLike<RunInput, RunOutput> = [
  RunnableLike<RunInput, boolean>,
  RunnableLike<RunInput, RunOutput>
];

/**
 * Class that represents a runnable branch. The RunnableBranch is
 * initialized with an array of branches and a default branch. When invoked,
 * it evaluates the condition of each branch in order and executes the
 * corresponding branch if the condition is true. If none of the conditions
 * are true, it executes the default branch.
 * @example
 * ```typescript
 * const branch = RunnableBranch.from([
 *   [
 *     (x: { topic: string; question: string }) =>
 *       x.topic.toLowerCase().includes("anthropic"),
 *     anthropicChain,
 *   ],
 *   [
 *     (x: { topic: string; question: string }) =>
 *       x.topic.toLowerCase().includes("langchain"),
 *     langChainChain,
 *   ],
 *   generalChain,
 * ]);
 *
 * const fullChain = RunnableSequence.from([
 *   {
 *     topic: classificationChain,
 *     question: (input: { question: string }) => input.question,
 *   },
 *   branch,
 * ]);
 *
 * const result = await fullChain.invoke({
 *   question: "how do I use LangChain?",
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class RunnableBranch<RunInput = any, RunOutput = any> extends Runnable<
  RunInput,
  RunOutput
> {
  static lc_name() {
    return "RunnableBranch";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  default: Runnable<RunInput, RunOutput>;

  branches: Branch<RunInput, RunOutput>[];

  constructor(fields: {
    branches: Branch<RunInput, RunOutput>[];
    default: Runnable<RunInput, RunOutput>;
  }) {
    super(fields);
    this.branches = fields.branches;
    this.default = fields.default;
  }

  /**
   * Convenience method for instantiating a RunnableBranch from
   * RunnableLikes (objects, functions, or Runnables).
   *
   * Each item in the input except for the last one should be a
   * tuple with two items. The first is a "condition" RunnableLike that
   * returns "true" if the second RunnableLike in the tuple should run.
   *
   * The final item in the input should be a RunnableLike that acts as a
   * default branch if no other branches match.
   *
   * @example
   * ```ts
   * import { RunnableBranch } from "@langchain/core/runnables";
   *
   * const branch = RunnableBranch.from([
   *   [(x: number) => x > 0, (x: number) => x + 1],
   *   [(x: number) => x < 0, (x: number) => x - 1],
   *   (x: number) => x
   * ]);
   * ```
   * @param branches An array where the every item except the last is a tuple of [condition, runnable]
   *   pairs. The last item is a default runnable which is invoked if no other condition matches.
   * @returns A new RunnableBranch.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static from<RunInput = any, RunOutput = any>(
    branches: [
      ...BranchLike<RunInput, RunOutput>[],
      RunnableLike<RunInput, RunOutput>
    ]
  ) {
    if (branches.length < 1) {
      throw new Error("RunnableBranch requires at least one branch");
    }
    const branchLikes = branches.slice(0, -1) as BranchLike<
      RunInput,
      RunOutput
    >[];
    const coercedBranches: Branch<RunInput, RunOutput>[] = branchLikes.map(
      ([condition, runnable]) => [
        _coerceToRunnable(condition),
        _coerceToRunnable(runnable),
      ]
    );
    const defaultBranch = _coerceToRunnable(
      branches[branches.length - 1] as RunnableLike<RunInput, RunOutput>
    );
    return new this({
      branches: coercedBranches,
      default: defaultBranch,
    });
  }

  async _invoke(
    input: RunInput,
    config?: Partial<RunnableConfig>,
    runManager?: CallbackManagerForChainRun
  ): Promise<RunOutput> {
    let result;
    for (let i = 0; i < this.branches.length; i += 1) {
      const [condition, branchRunnable] = this.branches[i];
      const conditionValue = await condition.invoke(
        input,
        patchConfig(config, {
          callbacks: runManager?.getChild(`condition:${i + 1}`),
        })
      );
      if (conditionValue) {
        result = await branchRunnable.invoke(
          input,
          patchConfig(config, {
            callbacks: runManager?.getChild(`branch:${i + 1}`),
          })
        );
        break;
      }
    }
    if (!result) {
      result = await this.default.invoke(
        input,
        patchConfig(config, {
          callbacks: runManager?.getChild("branch:default"),
        })
      );
    }
    return result;
  }

  async invoke(
    input: RunInput,
    config: RunnableConfig = {}
  ): Promise<RunOutput> {
    return this._callWithConfig(this._invoke, input, config);
  }

  async *_streamIterator(input: RunInput, config?: Partial<RunnableConfig>) {
    const callbackManager_ = await getCallbackManagerForConfig(config);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      config?.runId,
      undefined,
      undefined,
      undefined,
      config?.runName
    );
    let finalOutput;
    let finalOutputSupported = true;
    let stream;
    try {
      for (let i = 0; i < this.branches.length; i += 1) {
        const [condition, branchRunnable] = this.branches[i];
        const conditionValue = await condition.invoke(
          input,
          patchConfig(config, {
            callbacks: runManager?.getChild(`condition:${i + 1}`),
          })
        );
        if (conditionValue) {
          stream = await branchRunnable.stream(
            input,
            patchConfig(config, {
              callbacks: runManager?.getChild(`branch:${i + 1}`),
            })
          );
          for await (const chunk of stream) {
            yield chunk;
            if (finalOutputSupported) {
              if (finalOutput === undefined) {
                finalOutput = chunk;
              } else {
                try {
                  finalOutput = concat(finalOutput, chunk);
                } catch {
                  finalOutput = undefined;
                  finalOutputSupported = false;
                }
              }
            }
          }
          break;
        }
      }
      if (stream === undefined) {
        stream = await this.default.stream(
          input,
          patchConfig(config, {
            callbacks: runManager?.getChild("branch:default"),
          })
        );
        for await (const chunk of stream) {
          yield chunk;
          if (finalOutputSupported) {
            if (finalOutput === undefined) {
              finalOutput = chunk;
            } else {
              try {
                finalOutput = concat(finalOutput, chunk as RunOutput);
              } catch {
                finalOutput = undefined;
                finalOutputSupported = false;
              }
            }
          }
        }
      }
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    await runManager?.handleChainEnd(finalOutput ?? {});
  }
}

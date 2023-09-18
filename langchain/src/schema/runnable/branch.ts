import { Runnable, RunnableLike, _coerceToRunnable } from "./base.js";
import { RunnableConfig } from "./config.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";

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
 */
export class RunnableBranch<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  branches: Branch<RunInput, RunOutput>[];

  default: Runnable<RunInput, RunOutput>;

  lc_serializable = true;

  lc_namespace = ["langchain", "runnable", "branch"];

  constructor(fields: {
    branches: Branch<RunInput, RunOutput>[];
    default: Runnable<RunInput, RunOutput>;
  }) {
    super(fields);
    this.branches = fields.branches;
    this.default = fields.default;
  }

  static from<RunInput, RunOutput>(
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
        this._patchConfig(config, runManager?.getChild(`condition:${i + 1}`))
      );
      if (conditionValue) {
        result = await branchRunnable.invoke(
          input,
          this._patchConfig(config, runManager?.getChild(`branch:${i + 1}`))
        );
        break;
      }
    }
    if (!result) {
      result = await this.default.invoke(
        input,
        this._patchConfig(config, runManager?.getChild("default"))
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
}

import { ToolRunnableConfig } from "./types";

/**
 * Context passed to every {@link ToolPolicy} hook.
 */
export interface ToolPolicyContext<TIn> {
  /**
   * The name registered on the tool.
   */
  toolName: string;

  /**
   * Schema-validated input the tool will receive (or has just received, for `afterInvoke`).
   */
  args: TIn;

  /**
   * Merged {@link ToolRunnableConfig} for this invocation. Runtime data (e.g. permission
   * rules) lives in `config.configurable`.
   */
  config: ToolRunnableConfig;
}

/**
 * Generic lifecycle hook that runs around tool invocation.
 *
 * `ToolPolicy` is intentionally minimal. It does not attempt to model
 * approval flows or interrupt-style pauses — for those, use agent-level
 * middleware. Policies are for concerns that travel with the tool
 * itself, regardless of caller.
 *
 * @typeParam TIn - The parsed input type (schema output).
 * @typeParam TOut - The tool's raw output type.
 */
export interface ToolPolicy<TIn = unknown, TOut = unknown> {
  /**
   * Runs after schema validation, before `_call`. Throwing aborts the invocation;
   * the thrown error flows through the same path as runtime errors (callbacks, error
   * tool messages).
   */
  beforeInvoke?: (ctx: ToolPolicyContext<TIn>) => void | Promise<void>;

  /**
   * Runs after `_call` succeeds. Return a transformed output if needed; return the
   * input unchanged otherwise.
   */
  afterInvoke?: (
    output: TOut,
    ctx: ToolPolicyContext<TIn>
  ) => TOut | Promise<TOut>;
}

/**
 * Compose multiple policies into a single policy.
 *
 * Both `beforeInvoke` and `afterInvoke` run in forward order (first policy first).
 */
export function composePolicies<TIn, TOut>(
  ...policies: ToolPolicy<TIn, TOut>[]
): ToolPolicy<TIn, TOut> {
  const beforeInvoke = async (ctx: ToolPolicyContext<TIn>) => {
    for (const policy of policies) {
      if (policy.beforeInvoke !== undefined) {
        await policy.beforeInvoke(ctx);
      }
    }
  };

  const afterInvoke = async (output: TOut, ctx: ToolPolicyContext<TIn>) => {
    let current = output;
    for (const policy of policies) {
      if (policy.afterInvoke !== undefined) {
        current = await policy.afterInvoke(current, ctx);
      }
    }
    return current;
  };

  return { beforeInvoke, afterInvoke };
}

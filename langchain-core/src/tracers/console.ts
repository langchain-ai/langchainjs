import type { CSPair } from "ansi-styles";
import styles from "ansi-styles";
import { BaseTracer, type AgentRun, type Run } from "./base.js";

function wrap(style: CSPair, text: string) {
  return `${style.open}${text}${style.close}`;
}

function tryJsonStringify(obj: unknown, fallback: string) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    return fallback;
  }
}

function elapsed(run: Run): string {
  if (!run.end_time) return "";
  const elapsed = run.end_time - run.start_time;
  if (elapsed < 1000) {
    return `${elapsed}ms`;
  }
  return `${(elapsed / 1000).toFixed(2)}s`;
}

const { color } = styles;

/**
 * A tracer that logs all events to the console. It extends from the
 * `BaseTracer` class and overrides its methods to provide custom logging
 * functionality.
 * @example
 * ```typescript
 *
 * const llm = new ChatAnthropic({
 *   temperature: 0,
 *   tags: ["example", "callbacks", "constructor"],
 *   callbacks: [new ConsoleCallbackHandler()],
 * });
 *
 * ```
 */
export class ConsoleCallbackHandler extends BaseTracer {
  name = "console_callback_handler" as const;

  /**
   * Method used to persist the run. In this case, it simply returns a
   * resolved promise as there's no persistence logic.
   * @param _run The run to persist.
   * @returns A resolved promise.
   */
  protected persistRun(_run: Run) {
    return Promise.resolve();
  }

  // utility methods

  /**
   * Method used to get all the parent runs of a given run.
   * @param run The run whose parents are to be retrieved.
   * @returns An array of parent runs.
   */
  getParents(run: Run) {
    const parents: Run[] = [];
    let currentRun = run;
    while (currentRun.parent_run_id) {
      const parent = this.runMap.get(currentRun.parent_run_id);
      if (parent) {
        parents.push(parent);
        currentRun = parent;
      } else {
        break;
      }
    }
    return parents;
  }

  /**
   * Method used to get a string representation of the run's lineage, which
   * is used in logging.
   * @param run The run whose lineage is to be retrieved.
   * @returns A string representation of the run's lineage.
   */
  getBreadcrumbs(run: Run) {
    const parents = this.getParents(run).reverse();
    const string = [...parents, run]
      .map((parent, i, arr) => {
        const name = `${parent.execution_order}:${parent.run_type}:${parent.name}`;
        return i === arr.length - 1 ? wrap(styles.bold, name) : name;
      })
      .join(" > ");
    return wrap(color.grey, string);
  }

  // logging methods

  /**
   * Method used to log the start of a chain run.
   * @param run The chain run that has started.
   * @returns void
   */
  onChainStart(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[chain/start]"
      )} [${crumbs}] Entering Chain run with input: ${tryJsonStringify(
        run.inputs,
        "[inputs]"
      )}`
    );
  }

  /**
   * Method used to log the end of a chain run.
   * @param run The chain run that has ended.
   * @returns void
   */
  onChainEnd(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[chain/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting Chain run with output: ${tryJsonStringify(
        run.outputs,
        "[outputs]"
      )}`
    );
  }

  /**
   * Method used to log any errors of a chain run.
   * @param run The chain run that has errored.
   * @returns void
   */
  onChainError(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.red, "[chain/error]")} [${crumbs}] [${elapsed(
        run
      )}] Chain run errored with error: ${tryJsonStringify(
        run.error,
        "[error]"
      )}`
    );
  }

  /**
   * Method used to log the start of an LLM run.
   * @param run The LLM run that has started.
   * @returns void
   */
  onLLMStart(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    const inputs =
      "prompts" in run.inputs
        ? { prompts: (run.inputs.prompts as string[]).map((p) => p.trim()) }
        : run.inputs;
    console.log(
      `${wrap(
        color.green,
        "[llm/start]"
      )} [${crumbs}] Entering LLM run with input: ${tryJsonStringify(
        inputs,
        "[inputs]"
      )}`
    );
  }

  /**
   * Method used to log the end of an LLM run.
   * @param run The LLM run that has ended.
   * @returns void
   */
  onLLMEnd(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[llm/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting LLM run with output: ${tryJsonStringify(
        run.outputs,
        "[response]"
      )}`
    );
  }

  /**
   * Method used to log any errors of an LLM run.
   * @param run The LLM run that has errored.
   * @returns void
   */
  onLLMError(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.red, "[llm/error]")} [${crumbs}] [${elapsed(
        run
      )}] LLM run errored with error: ${tryJsonStringify(run.error, "[error]")}`
    );
  }

  /**
   * Method used to log the start of a tool run.
   * @param run The tool run that has started.
   * @returns void
   */
  onToolStart(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[tool/start]"
      )} [${crumbs}] Entering Tool run with input: "${run.inputs.input?.trim()}"`
    );
  }

  /**
   * Method used to log the end of a tool run.
   * @param run The tool run that has ended.
   * @returns void
   */
  onToolEnd(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[tool/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting Tool run with output: "${run.outputs?.output?.trim()}"`
    );
  }

  /**
   * Method used to log any errors of a tool run.
   * @param run The tool run that has errored.
   * @returns void
   */
  onToolError(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.red, "[tool/error]")} [${crumbs}] [${elapsed(
        run
      )}] Tool run errored with error: ${tryJsonStringify(
        run.error,
        "[error]"
      )}`
    );
  }

  /**
   * Method used to log the start of a retriever run.
   * @param run The retriever run that has started.
   * @returns void
   */
  onRetrieverStart(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[retriever/start]"
      )} [${crumbs}] Entering Retriever run with input: ${tryJsonStringify(
        run.inputs,
        "[inputs]"
      )}`
    );
  }

  /**
   * Method used to log the end of a retriever run.
   * @param run The retriever run that has ended.
   * @returns void
   */
  onRetrieverEnd(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[retriever/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting Retriever run with output: ${tryJsonStringify(
        run.outputs,
        "[outputs]"
      )}`
    );
  }

  /**
   * Method used to log any errors of a retriever run.
   * @param run The retriever run that has errored.
   * @returns void
   */
  onRetrieverError(run: Run) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.red, "[retriever/error]")} [${crumbs}] [${elapsed(
        run
      )}] Retriever run errored with error: ${tryJsonStringify(
        run.error,
        "[error]"
      )}`
    );
  }

  /**
   * Method used to log the action selected by the agent.
   * @param run The run in which the agent action occurred.
   * @returns void
   */
  onAgentAction(run: Run) {
    const agentRun = run as AgentRun;
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.blue,
        "[agent/action]"
      )} [${crumbs}] Agent selected action: ${tryJsonStringify(
        agentRun.actions[agentRun.actions.length - 1],
        "[action]"
      )}`
    );
  }
}

import type { CSPair } from "ansi-styles";
import styles from "ansi-styles";
import { BaseTracer, BaseTracerSession, AgentRunV2, RunV2 } from "./tracers.js";

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

function elapsed(run: RunV2): string {
  const elapsed = run.end_time - run.start_time;
  if (elapsed < 1000) {
    return `${elapsed}ms`;
  }
  return `${(elapsed / 1000).toFixed(2)}s`;
}

const { color } = styles;

export class ConsoleCallbackHandler extends BaseTracer {
  name = "console_callback_handler" as const;

  // boilerplate to work with the base tracer class

  constructor() {
    super();
  }

  i = 0;

  protected persistSession(session: BaseTracerSession) {
    // eslint-disable-next-line no-plusplus
    return Promise.resolve({ ...session, id: this.i++ });
  }

  protected persistRun(_run: RunV2) {
    return Promise.resolve();
  }

  loadDefaultSession() {
    return this.newSession();
  }

  loadSession(sessionName: string) {
    return this.newSession(sessionName);
  }

  // utility methods

  getParents(run: RunV2) {
    const parents: RunV2[] = [];
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

  getBreadcrumbs(run: RunV2) {
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

  onChainStart(run: RunV2) {
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

  onChainEnd(run: RunV2) {
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

  onChainError(run: RunV2) {
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

  onLLMStart(run: RunV2) {
    const crumbs = this.getBreadcrumbs(run);
    const prompts = run.inputs.prompts as string[];
    console.log(
      `${wrap(
        color.green,
        "[llm/start]"
      )} [${crumbs}] Entering LLM run with input: ${tryJsonStringify(
        { prompts: prompts.map((p) => p.trim()) },
        "[inputs]"
      )}`
    );
  }

  onLLMEnd(run: RunV2) {
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

  onLLMError(run: RunV2) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.red, "[llm/error]")} [${crumbs}] [${elapsed(
        run
      )}] LLM run errored with error: ${tryJsonStringify(run.error, "[error]")}`
    );
  }

  onToolStart(run: RunV2) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[tool/start]"
      )} [${crumbs}] Entering Tool run with input: "${run.inputs.input?.trim()}"`
    );
  }

  onToolEnd(run: RunV2) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[tool/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting Tool run with output: "${run.outputs.output?.trim()}"`
    );
  }

  onToolError(run: RunV2) {
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

  onAgentAction(run: RunV2) {
    const agentRun = run as AgentRunV2;
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

import type { CSPair } from "ansi-styles";
import styles from "ansi-styles";
import {
  AgentRun,
  BaseTracer,
  BaseTracerSession,
  ChainRun,
  LLMRun,
  Run,
  ToolRun,
} from "./tracers.js";

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

  protected persistRun(_run: Run) {
    return Promise.resolve();
  }

  loadDefaultSession() {
    return this.newSession();
  }

  loadSession(sessionName: string) {
    return this.newSession(sessionName);
  }

  // utility methods

  getParents(run: Run) {
    const parents: Run[] = [];
    let currentRun = run;
    while (currentRun.parent_uuid) {
      const parent = this.runMap.get(currentRun.parent_uuid);
      if (parent) {
        parents.push(parent);
        currentRun = parent;
      } else {
        break;
      }
    }
    return parents;
  }

  getBreadcrumbs(run: Run) {
    const parents = this.getParents(run).reverse();
    const string = [...parents, run]
      .map((parent, i, arr) => {
        const name = `${parent.execution_order}:${parent.type}:${parent.serialized?.name}`;
        return i === arr.length - 1 ? wrap(styles.bold, name) : name;
      })
      .join(" > ");
    return wrap(color.grey, string);
  }

  // logging methods

  onChainStart(run: ChainRun) {
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

  onChainEnd(run: ChainRun) {
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

  onChainError(run: ChainRun) {
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

  onLLMStart(run: LLMRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[llm/start]"
      )} [${crumbs}] Entering LLM run with input: ${tryJsonStringify(
        { prompts: run.prompts.map((p) => p.trim()) },
        "[inputs]"
      )}`
    );
  }

  onLLMEnd(run: LLMRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[llm/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting LLM run with output: ${tryJsonStringify(
        run.response,
        "[response]"
      )}`
    );
  }

  onLLMError(run: LLMRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.red, "[llm/error]")} [${crumbs}] [${elapsed(
        run
      )}] LLM run errored with error: ${tryJsonStringify(run.error, "[error]")}`
    );
  }

  onToolStart(run: ToolRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[tool/start]"
      )} [${crumbs}] Entering Tool run with input: "${run.tool_input?.trim()}"`
    );
  }

  onToolEnd(run: ToolRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.cyan, "[tool/end]")} [${crumbs}] [${elapsed(
        run
      )}] Exiting Tool run with output: "${run.output?.trim()}"`
    );
  }

  onToolError(run: ToolRun) {
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

  onAgentAction(run: AgentRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.blue,
        "[agent/action]"
      )} [${crumbs}] Agent selected action: ${tryJsonStringify(
        run.actions[run.actions.length - 1],
        "[action]"
      )}`
    );
  }
}

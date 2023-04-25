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
    return JSON.stringify(obj);
  } catch (err) {
    return fallback;
  }
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

  copy() {
    return this;
  }

  // utility methods

  getParents(run: Run) {
    const parents = [];
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
      .map((parent, i, arr) =>
        i === arr.length - 1
          ? wrap(styles.bold, parent.serialized?.name)
          : parent.serialized?.name
      )
      .filter(Boolean)
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
      )} [${crumbs}] Entering Chain run with ${tryJsonStringify(
        run.inputs,
        "[inputs]"
      )}\n`
    );
  }

  onChainEnd(run: ChainRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.cyan,
        "[chain/end]"
      )} [${crumbs}] Exiting Chain run with ${tryJsonStringify(
        run.outputs,
        "[outputs]"
      )}\n`
    );
  }

  onChainError(run: ChainRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.red,
        "[chain/error]"
      )} [${crumbs}] Chain run errored with ${tryJsonStringify(
        run.error,
        "[error]"
      )}\n`
    );
  }

  onLLMStart(run: LLMRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[llm/start]"
      )} [${crumbs}] Entering LLM run with "${run.prompts
        .map((p) => p.trim())
        .join("\n---\n")}" \n`
    );
  }

  onLLMEnd(run: LLMRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.cyan,
        "[llm/end]"
      )} [${crumbs}] Exiting LLM run with ${tryJsonStringify(
        run.response,
        "[response]"
      )}\n`
    );
  }

  onLLMError(run: LLMRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.red,
        "[llm/error]"
      )} [${crumbs}] LLM run errored with ${tryJsonStringify(
        run.error,
        "[error]"
      )}\n`
    );
  }

  onToolStart(run: ToolRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.green,
        "[tool/start]"
      )} [${crumbs}] Entering Tool run with "${run.tool_input?.trim()}"\n`
    );
  }

  onToolEnd(run: ToolRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.cyan,
        "[tool/end]"
      )} [${crumbs}] Exiting Tool run with "${run.output?.trim()}"\n`
    );
  }

  onToolError(run: ToolRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.red,
        "[tool/error]"
      )} [${crumbs}] Tool run errored with ${tryJsonStringify(
        run.error,
        "[error]"
      )}\n`
    );
  }

  onAgentAction(run: AgentRun) {
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(
        color.blue,
        "[agent/action]"
      )} [${crumbs}] Agent selected action ${tryJsonStringify(
        run.actions[run.actions.length - 1],
        "[action]"
      )}\n`
    );
  }
}

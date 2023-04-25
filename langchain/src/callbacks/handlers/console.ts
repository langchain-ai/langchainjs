import type { CSPair } from "ansi-styles";
import styles from "ansi-styles";
import {
  AgentAction,
  AgentFinish,
  ChainValues,
  LLMResult,
} from "../../schema/index.js";
import { BaseTracer, BaseTracerSession, LLMRun, Run } from "./tracers.js";

function wrap(style: CSPair, text: string) {
  return `${style.open}${text}${style.close}`;
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
    return [...parents, run]
      .map((parent) => parent.serialized?.name)
      .filter(Boolean)
      .join(" > ");
  }

  // logging methods

  onLLMStart(run: LLMRun) {
    console.log("yoooooo");
    const crumbs = this.getBreadcrumbs(run);
    console.log(
      `${wrap(color.green, "[llm/start]")} ${wrap(color.grey, crumbs)}\n`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleLLMError(err: any, runId: string) {
    console.log(`LLM ${runId} errored: ${err}\n`);
  }

  async handleLLMEnd(output: LLMResult, runId: string) {
    console.log(`LLM ${runId} finished: ${JSON.stringify(output)}\n`);
  }

  async handleChainStart(chain: { name: string }) {
    console.log(`Entering new ${chain.name} chain...`);
  }

  async handleChainEnd(_output: ChainValues) {
    console.log("Finished chain.");
  }

  async handleAgentAction(action: AgentAction) {
    console.log(action.log);
  }

  async handleToolEnd(output: string) {
    console.log(output);
  }

  async handleText(text: string) {
    console.log(text);
  }

  async handleAgentEnd(action: AgentFinish) {
    console.log(action.log);
  }
}

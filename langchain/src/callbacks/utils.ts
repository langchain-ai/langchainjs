import * as process from "process";
import { LangChainTracer } from "./tracers.js";
import { CallbackManager, ConsoleCallbackHandler } from "./base.js";

export interface TracerOptions {
  sessionName?: string;
}

export function getCallbackManager(): CallbackManager {
  const manager = new CallbackManager();
  manager.setHandler(new ConsoleCallbackHandler());
  if (
    process.env.LANGCHAIN_HANDLER === "console" ||
    !process.env.LANGCHAIN_HANDLER
  ) {
    return manager;
  }
  if (process.env.LANGCHAIN_HANDLER === "langchain") {
    const tracingHandler = new LangChainTracer();
    manager.addHandler(tracingHandler);
    return manager;
  }
  throw new Error(
    `Invalid LANGCHAIN_HANDLER environment variable: ${process.env.LANGCHAIN_HANDLER}, must be one of: console, langchain.`
  );
}

export async function setTracerSession(
  callbackManager: CallbackManager,
  options?: TracerOptions
) {
  for (const handler of callbackManager.handlers) {
    if (handler instanceof LangChainTracer) {
      const sessionName = options?.sessionName;
      if (sessionName) {
        await handler.loadSession(sessionName);
      } else {
        await handler.loadDefaultSession();
      }
    }
  }
}

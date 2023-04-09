import { LangChainTracer } from "./tracers.js";
import { CallbackManager, ConsoleCallbackHandler } from "./base.js";

export class SingletonCallbackManager extends CallbackManager {
  private static instance: SingletonCallbackManager;

  private constructor() {
    super();
  }

  static getInstance(): SingletonCallbackManager {
    if (!SingletonCallbackManager.instance) {
      SingletonCallbackManager.instance = new SingletonCallbackManager();
      SingletonCallbackManager.instance.addHandler(
        new ConsoleCallbackHandler()
      );
      if (
        typeof process !== "undefined" &&
        // eslint-disable-next-line no-process-env
        process.env.LANGCHAIN_HANDLER === "langchain"
      ) {
        SingletonCallbackManager.instance.addHandler(new LangChainTracer());
      }
    }

    return SingletonCallbackManager.instance;
  }
}

export function getCallbackManager(): CallbackManager {
  return SingletonCallbackManager.getInstance();
}

export interface TracerOptions {
  sessionName?: string;
}

export async function setTracerSession(
  options?: TracerOptions,
  callbackManager: CallbackManager = getCallbackManager()
) {
  for (const handler of callbackManager.handlers) {
    // fine to use instanceof here because we're in the same package
    // eslint-disable-next-line no-instanceof/no-instanceof
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

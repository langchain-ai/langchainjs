import { Client } from "langsmith";
import { getEnvironmentVariable } from "../utils/env.js";

let client: Client;

export const getDefaultLangChainClientSingleton = () => {
  if (client === undefined) {
    const clientParams =
      getEnvironmentVariable("LANGCHAIN_CALLBACKS_BACKGROUND") === "false"
        ? {
            // LangSmith has its own backgrounding system
            blockOnRootRunFinalization: true,
          }
        : {};
    client = new Client(clientParams);
  }
  return client;
};

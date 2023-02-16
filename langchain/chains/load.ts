import { BaseChain } from ".";
import { loadFromHub } from "../util/hub";
import { parseFileConfig } from "../util";

const loadChainFromFile = async (file: string) => {
  const serialized = parseFileConfig(file);
  return BaseChain.deserialize(serialized);
};

/**
 * Load a chain from {@link https://github.com/hwchase17/langchain-hub | LangchainHub} or local filesystem.
 *
 * @example
 * Loading from LangchainHub:
 * ```ts
 * import { loadChain } from "langchain/chains";
 * const chain = await loadChain("lc://chains/hello-world/chain.json");
 * const res = await chain.call({ topic: "my favorite color" });
 * ```
 *
 * @example
 * Loading from local filesystem:
 * ```ts
 * import { loadChain } from "langchain/chains";
 * const chain = await loadChain("/path/to/chain.json");
 * ```
 */
export const loadChain = async (uri: string): Promise<BaseChain> => {
  const hubResult = await loadFromHub(
    uri,
    loadChainFromFile,
    "chains",
    new Set(["json", "yaml"])
  );
  if (hubResult) {
    return hubResult;
  }

  return loadChainFromFile(uri);
};

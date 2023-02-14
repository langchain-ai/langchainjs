import { BaseChain } from ".";
import { loadFromHub } from "../util/hub";
import { parseFileConfig } from "../util";

const loadChainFromFile = async (file: string) => {
  const serialized = parseFileConfig(file);
  console.log({ serialized });
  return BaseChain.deserialize(serialized);
};

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

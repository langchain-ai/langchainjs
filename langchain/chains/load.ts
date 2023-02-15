import { BaseChain } from ".";
import { loadFromHub } from "../util/hub";
import { parseFileConfig } from "../util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

const loadChainFromFile = async (file: string, values: LoadValues = {}) => {
  const serialized = parseFileConfig(file);
  console.log({ serialized });
  return BaseChain.deserialize(serialized, values);
};

export const loadChain = async (
  uri: string,
  values: LoadValues = {}
): Promise<BaseChain> => {
  const hubResult = await loadFromHub(
    uri,
    loadChainFromFile,
    "chains",
    new Set(["json", "yaml"]),
    values
  );
  if (hubResult) {
    return hubResult;
  }

  return loadChainFromFile(uri, values);
};

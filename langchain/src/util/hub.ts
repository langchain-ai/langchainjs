import pRetry from "p-retry";

import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { FileLoader, LoadValues } from "./load.js";
import { extname } from "./extname.js";

const fetchWithTimeout = async (
  url: string,
  init: Omit<RequestInit, "signal"> & { timeout: number }
) => {
  const { timeout, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
  });
  return res;
};

const HUB_PATH_REGEX = /lc(@[^:]+)?:\/\/(.*)/;

const URL_PATH_SEPARATOR = "/";

export const loadFromHub = async <T>(
  uri: string,
  loader: FileLoader<T>,
  validPrefix: string,
  validSuffixes: Set<string>,
  values: LoadValues = {}
): Promise<T | undefined> => {
  const LANGCHAIN_HUB_DEFAULT_REF =
    getEnvironmentVariable("LANGCHAIN_HUB_DEFAULT_REF") ?? "master";
  const LANGCHAIN_HUB_URL_BASE =
    getEnvironmentVariable("LANGCHAIN_HUB_URL_BASE") ??
    "https://raw.githubusercontent.com/hwchase17/langchain-hub/";

  const match = uri.match(HUB_PATH_REGEX);
  if (!match) {
    return undefined;
  }
  const [rawRef, remotePath] = match.slice(1);
  const ref = rawRef ? rawRef.slice(1) : LANGCHAIN_HUB_DEFAULT_REF;
  const parts = remotePath.split(URL_PATH_SEPARATOR);
  if (parts[0] !== validPrefix) {
    return undefined;
  }

  if (!validSuffixes.has(extname(remotePath).slice(1))) {
    throw new Error("Unsupported file type.");
  }

  const url = [LANGCHAIN_HUB_URL_BASE, ref, remotePath].join("/");
  const res = await pRetry(() => fetchWithTimeout(url, { timeout: 5000 }), {
    retries: 6,
  });
  if (res.status !== 200) {
    throw new Error(`Could not find file at ${url}`);
  }

  return loader(await res.text(), remotePath, values);
};

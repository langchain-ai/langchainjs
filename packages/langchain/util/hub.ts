import path from "path";
import os from "os";
import fs from "fs";
import { fetchWithTimeout } from "./index";

const HUB_PATH_REGEX = /lc(@[^:]+)?:\/\/(.*)/;
const DEFAULT_REF = process.env.LANGCHAIN_HUB_DEFAULT_REF ?? "master";
const URL_BASE =
  process.env.LANGCHAIN_HUB_URL_BASE ??
  "https://raw.githubusercontent.com/hwchase17/langchain-hub/";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

const URL_PATH_SEPARATOR = "/";

export const loadFromHub = async <T>(
  uri: string,
  loader: (a: string, values: LoadValues) => T,
  validPrefix: string,
  validSuffixes: Set<string>,
  values: LoadValues = {}
): Promise<T | undefined> => {
  const match = uri.match(HUB_PATH_REGEX);
  if (!match) {
    return undefined;
  }
  const [rawRef, remotePath] = match.slice(1);
  const ref = rawRef ? rawRef.slice(1) : DEFAULT_REF;
  const parts = remotePath.split(URL_PATH_SEPARATOR);
  if (parts[0] !== validPrefix) {
    return undefined;
  }

  if (!validSuffixes.has(path.extname(remotePath).slice(1))) {
    throw new Error("Unsupported file type.");
  }

  const url = [URL_BASE, ref, remotePath].join("/");
  const res = await fetchWithTimeout(url, { timeout: 5000 });
  if (res.status !== 200) {
    throw new Error(`Could not find file at ${url}`);
  }

  const text = await res.text();
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "langchain"));
  const file = path.join(
    tmpdir,
    path.basename(remotePath.replace(URL_PATH_SEPARATOR, path.sep))
  );
  fs.writeFileSync(file, text);
  return loader(file, values);
};

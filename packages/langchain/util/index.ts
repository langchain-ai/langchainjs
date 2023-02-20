import path from "path";
import fetch, { RequestInit } from "node-fetch";
import fs from "fs";
import * as yaml from "yaml";

export const fetchWithTimeout = async (
  url: string,
  init: Omit<RequestInit, "signal"> & { timeout: number }
) => {
  const { timeout, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, { ...rest, signal: controller.signal as any });
  clearTimeout(timeoutId);
  return res;
};

const loadFileContents = (contents: string, format: string) => {
  switch (format) {
    case ".json":
      return JSON.parse(contents);
    case ".yml":
    case ".yaml":
      return yaml.parse(contents);
    default:
      throw new Error(`Unsupported filetype ${format}`);
  }
};

/*
 * More strict typing, i.e. { [field]: T } | { [field_path]: string }
type OneFieldOf<T> = keyof T extends infer U
  ? U extends keyof T
  ? {[key in U]: T[U]} : never : never;

type FromPath<key extends string, T> = OneFieldOf<{ [k in key]: T } & { [k in `${key}_path`]: string }>;
*/

export type FromPath<key extends string, T> = {
  [k in key]?: T;
} & {
  [k in `${key}_path`]?: string;
};

const resolveFieldFromFile = <K extends string, R, T extends R>(
  fieldName: K,
  config: FromPath<K, T>,
  load: (contents: string, suffix: string) => R,
  allowExtensions?: string[]
): R => {
  const fieldPath = config[`${fieldName}_path`] as string | undefined;
  const field = config[fieldName] as T | undefined;
  if (fieldPath !== undefined && field !== undefined) {
    throw new Error(
      `Both '${fieldName}_path' and '${fieldName}' cannot be provided.`
    );
  }

  if (field !== undefined) {
    return field;
  }

  if (fieldPath !== undefined) {
    const suffix = path.extname(fieldPath);
    if (allowExtensions && !allowExtensions.includes(suffix)) {
      throw new Error("Invalid file type");
    }

    return load(fs.readFileSync(fieldPath).toString(), suffix);
  }

  throw new Error(
    `One of '${fieldName}_path' and '${fieldName}' must be provided.`
  );
};

export const resolveTemplateFromFile = <K extends string>(
  fieldName: K,
  config: FromPath<K, string>
) => resolveFieldFromFile(fieldName, config, (contents) => contents, [".txt"]);

export const resolveConfigFromFile = <K extends string, T>(
  fieldName: K,
  config: FromPath<K, T>
): T =>
  resolveFieldFromFile(fieldName, config, loadFileContents, [".json", ".yaml"]);

export const parseFileConfig = (file: string, supportedTypes?: string[]) => {
  const suffix = path.extname(file);

  if (
    ![".json", ".yaml"].includes(suffix) ||
    (supportedTypes && !supportedTypes.includes(suffix))
  ) {
    throw new Error(`Unsupported filetype ${suffix}`);
  }

  const contents = fs.readFileSync(file).toString();
  return loadFileContents(contents, suffix);
};

export const chunkArray = <T>(arr: T[], chunkSize: number) =>
  arr.reduce((chunks, elem, index) => {
    const chunkIndex = Math.floor(index / chunkSize);
    const chunk = chunks[chunkIndex] || [];
    // eslint-disable-next-line no-param-reassign
    chunks[chunkIndex] = chunk.concat([elem]);
    return chunks;
  }, [] as T[][]);

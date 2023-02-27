import * as yaml from "yaml";

export const extname = (path: string) => `.${path.split(".").pop()}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export type FileLoader<T> = (
  text: string,
  filePath: string,
  values: LoadValues
) => Promise<T>;

export const loadFromFile = async <T>(
  uri: string,
  loader: FileLoader<T>,
  values: LoadValues = {}
): Promise<T> => {
  try {
    const fs = await import("fs/promises");
    return loader(await fs.readFile(uri, { encoding: "utf-8" }), uri, values);
  } catch (e) {
    console.error(e);
    throw new Error(`Could not load file at ${uri}`);
  }
};

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

const resolveFieldFromFile = async <K extends string, R, T extends R>(
  fieldName: K,
  config: FromPath<K, T>,
  load: (contents: string, suffix: string) => R,
  allowExtensions?: string[]
): Promise<R> => {
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
    const suffix = extname(fieldPath);
    if (allowExtensions && !allowExtensions.includes(suffix)) {
      throw new Error("Invalid file type");
    }

    try {
      const fs = await import("fs/promises");

      return load(await fs.readFile(fieldPath, { encoding: "utf-8" }), suffix);
    } catch (e) {
      console.error(e);
      throw new Error(`Unable to read file ${fieldPath}: ${e}`);
    }
  }

  throw new Error(
    `One of '${fieldName}_path' and '${fieldName}' must be provided.`
  );
};

export const resolveTemplateFromFile = async <K extends string>(
  fieldName: K,
  config: FromPath<K, string>
) => resolveFieldFromFile(fieldName, config, (contents) => contents, [".txt"]);

export const resolveConfigFromFile = async <K extends string, T>(
  fieldName: K,
  config: FromPath<K, T>
): Promise<T> =>
  resolveFieldFromFile(fieldName, config, loadFileContents, [".json", ".yaml"]);

export const parseFileConfig = (
  text: string,
  path: string,
  supportedTypes?: string[]
) => {
  const suffix = extname(path);

  if (
    ![".json", ".yaml"].includes(suffix) ||
    (supportedTypes && !supportedTypes.includes(suffix))
  ) {
    throw new Error(`Unsupported filetype ${suffix}`);
  }

  return loadFileContents(text, suffix);
};

export const chunkArray = <T>(arr: T[], chunkSize: number) =>
  arr.reduce((chunks, elem, index) => {
    const chunkIndex = Math.floor(index / chunkSize);
    const chunk = chunks[chunkIndex] || [];
    // eslint-disable-next-line no-param-reassign
    chunks[chunkIndex] = chunk.concat([elem]);
    return chunks;
  }, [] as T[][]);

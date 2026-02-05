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
    const fs = await import("node:fs/promises");
    return loader(await fs.readFile(uri, { encoding: "utf-8" }), uri, values);
  } catch (e) {
    console.error(e);
    throw new Error(`Could not load file at ${uri}`);
  }
};

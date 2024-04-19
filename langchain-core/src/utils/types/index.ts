export * from "./is_zod_schema.js";

/**
 * Represents a string value with autocompleted, but not required, suggestions.
 */

export type StringWithAutocomplete<T> = T | (string & Record<never, never>);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues<K extends string = string, V = any> = Record<K, V>;

export type InputValues_FSTRING = InputValues & { __FSTRING: true };

export type PartialValues<K extends string = string> = Record<
  K,
  string | (() => Promise<string>) | (() => string)
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;

/**
 * Represents a string value with autocompleted, but not required, suggestions.
 */

export type StringWithAutocomplete<T> = T | (string & Record<never, never>);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues<K extends string = string> = Record<K, any>;

export type PartialValues<K extends string = string> = Record<
  K,
  string | (() => Promise<string>) | (() => string)
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;

export { insecureHash } from "./js-sha1/hash.js";
export { sha256 } from "./js-sha256/hash.js";

/**
 * A function type for encoding hash keys.
 * Accepts any number of string arguments (such as prompt and LLM key)
 * and returns a single string to be used as the hash key.
 */
export type HashKeyEncoder = (...strings: string[]) => string;

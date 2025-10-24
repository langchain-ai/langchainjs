import { MaskingTransformer } from "./transformer.js";
/**
 * Configuration type for MaskingParser.
 */

export type MaskingParserConfig = {
  transformers?: MaskingTransformer[];
  defaultHashFunction?: HashFunction;
  onMaskingStart?: HookFunction;
  onMaskingEnd?: HookFunction;
  onRehydratingStart?: HookFunction;
  onRehydratingEnd?: HookFunction;
};

/**
 *  Regex Masking Pattern used for masking in PIIMaskingTransformer.
 */
export type MaskingPattern = {
  regex: RegExp;
  replacement?: string;
  mask?: (match: string) => string;
};

export type HookFunction =
  | ((message: string) => Promise<void>)
  | ((message: string) => void);

/**
 * Represents a function that can hash a string input.
 */
export type HashFunction = (input: string) => string;

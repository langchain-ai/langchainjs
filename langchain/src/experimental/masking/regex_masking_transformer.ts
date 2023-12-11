import { MaskingTransformer } from "./transformer.js";
import type { HashFunction, MaskingPattern } from "./types.js";
/**
 * RegexMaskingTransformer class for masking and rehydrating messages with Regex.
 */
export class RegexMaskingTransformer extends MaskingTransformer {
  private patterns: { [key: string]: MaskingPattern };

  private hashFunction: HashFunction;

  /**
   * Constructs a RegexMaskingTransformer with given patterns and an optional hash function.
   * Validates the provided patterns to ensure they conform to the expected structure.
   *
   * @param patterns - An object containing masking patterns. Each pattern should include
   *                   a regular expression (`regex`) and optionally a `replacement` string
   *                   or a `mask` function.
   * @param hashFunction - An optional custom hash function to be used for masking.
   */
  constructor(
    patterns: { [key: string]: MaskingPattern },
    hashFunction?: HashFunction
  ) {
    super();
    // Validates the provided masking patterns before initializing the transformer.
    // This ensures that each pattern has a valid regular expression.
    this.validatePatterns(patterns);

    // Assigns the validated patterns and the hash function to the transformer.
    // If no custom hash function is provided, the default hash function is used.
    this.patterns = patterns;
    this.hashFunction = hashFunction || this.defaultHashFunction;
  }

  /**
   * Validates the given masking patterns to ensure each pattern has a valid regular expression.
   * Throws an error if any pattern is found to be invalid.
   *
   * @param patterns - The patterns object to validate.
   */
  private validatePatterns(patterns: { [key: string]: MaskingPattern }) {
    for (const key of Object.keys(patterns)) {
      const pattern = patterns[key];
      // Checks that each pattern is an object and has a regex property that is an instance of RegExp.
      // Throws an error if these conditions are not met, indicating an invalid pattern configuration.
      if (
        !pattern ||
        typeof pattern !== "object" ||
        // eslint-disable-next-line no-instanceof/no-instanceof
        !(pattern.regex instanceof RegExp)
      ) {
        throw new Error("Invalid pattern configuration.");
      }
    }
  }

  /**
   * Masks content in a message based on the defined patterns.
   * @param message - The message to be masked.
   * @param state - The current state containing original values.
   * @returns A tuple of the masked message and the updated state.
   */
  async transform(
    message: string,
    state: Map<string, string>
  ): Promise<[string, Map<string, string>]> {
    if (typeof message !== "string") {
      throw new TypeError(
        "RegexMaskingTransformer.transform Error: The 'message' argument must be a string."
      );
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (!(state instanceof Map)) {
      throw new TypeError(
        "RegexMaskingTransformer.transform Error: The 'state' argument must be an instance of Map."
      );
    }

    // Holds the progressively masked message
    let processedMessage = message;

    // Initialize original values map with the current state or a new map
    const originalValues = state || new Map<string, string>();

    // Iterate over each pattern defined in the transformer
    for (const key of Object.keys(this.patterns)) {
      const pattern = this.patterns[key];

      // Apply the current pattern's regex to the message
      processedMessage = processedMessage.replace(pattern.regex, (match) => {
        // Determine the masked value: use the mask function if provided, else use the replacement string,
        // else use the hash function.
        const maskedValue = pattern.mask
          ? pattern.mask(match)
          : pattern.replacement ?? this.hashFunction(match);

        // Store the mapping of the masked value to the original value (match)
        originalValues.set(maskedValue, match);

        // Return the masked value to replace the original value in the message
        return maskedValue;
      });
    }

    // Return the fully masked message and the state map with all original values
    // Wrap the synchronous return values in Promise.resolve() to maintain compatibility
    // with the MaskingParser's expectation of a Promise return type.
    return [processedMessage, originalValues];
  }

  /**
   * Rehydrates a masked message back to its original form using the provided state.
   * @param message - The masked message to be rehydrated.
   * @param state - The state map containing mappings of masked values to their original values.
   * @returns The rehydrated (original) message.
   */
  async rehydrate(
    message: string,
    state: Map<string, string>
  ): Promise<string> {
    if (typeof message !== "string") {
      throw new TypeError(
        "RegexMaskingTransformer.rehydrate Error: The 'message' argument must be a string."
      );
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (!(state instanceof Map)) {
      throw new TypeError(
        "RegexMaskingTransformer.rehydrate Error: The 'state' argument must be an instance of Map."
      );
    }

    // Convert the state map to an array and use reduce to sequentially replace masked values with original values.
    const rehydratedMessage = Array.from(state).reduce(
      (msg, [masked, original]) => {
        // Escape special characters in the masked string to ensure it can be used in a regular expression safely.
        // This is necessary because masked values might contain characters that have special meanings in regex.
        const escapedMasked = masked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Replace all instances of the escaped masked value in the message with the original value.
        // The 'g' flag in the RegExp ensures that all occurrences of the masked value are replaced.
        return msg.replace(new RegExp(escapedMasked, "g"), original);
      },
      message
    );

    return rehydratedMessage;
  }

  /**
   * Default hash function for creating unique hash values.
   * @param input - The input string to hash.
   * @returns The resulting hash as a string.
   */
  private defaultHashFunction(input: string): string {
    let hash = 0;
    // Iterate over each character in the input string
    for (let i = 0; i < input.length; i += 1) {
      // Get ASCII value of the character
      const char = input.charCodeAt(i);
      // Combine the current hash with the new character and ensure it remains a 32-bit integer
      hash = (hash << 5) - hash + char;
      // Bitwise OR operation to convert to a 32-bit integer.
      // This is a common technique to ensure the final hash value stays within the 32-bit limit,
      // effectively wrapping the value when it becomes too large.
      hash |= 0;
    }

    // Convert the numerical hash value to a string and return
    return hash.toString();
  }
}

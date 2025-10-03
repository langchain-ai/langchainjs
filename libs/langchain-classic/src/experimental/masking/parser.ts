import { MaskingTransformer } from "./transformer.js";
import type { MaskingParserConfig } from "./types.js";

/**
 * MaskingParser class for handling the masking and rehydrating of messages.
 */
export class MaskingParser {
  private transformers: MaskingTransformer[];

  private state: Map<string, string>;

  private config: MaskingParserConfig;

  constructor(config: MaskingParserConfig = {}) {
    this.transformers = config.transformers ?? [];
    this.state = new Map<string, string>();
    this.config = config;
  }

  /**
   * Adds a transformer to the parser.
   * @param transformer - An instance of a class extending MaskingTransformer.
   */
  addTransformer(transformer: MaskingTransformer) {
    this.transformers.push(transformer);
  }

  /**
   * Getter method for retrieving the current state.
   * @returns The current state map.
   */
  public getState(): Map<string, string> {
    return this.state;
  }

  /**
   * Masks the provided message using the added transformers.
   * This method sequentially applies each transformer's masking logic to the message.
   * It utilizes a state map to track original values corresponding to their masked versions.
   *
   * @param message - The message to be masked.
   * @returns A masked version of the message.
   * @throws {TypeError} If the message is not a string.
   * @throws {Error} If no transformers are added.
   */
  async mask(message: string): Promise<string> {
    // If onMaskingStart is a function, handle it accordingly
    if (this.config.onMaskingStart) {
      await this.config.onMaskingStart(message);
    }

    // Check if there are any transformers added to the parser. If not, throw an error
    // as masking requires at least one transformer to apply its logic.
    if (this.transformers.length === 0) {
      throw new Error(
        "MaskingParser.mask Error: No transformers have been added. Please add at least one transformer before parsing."
      );
    }

    if (typeof message !== "string") {
      throw new TypeError(
        "MaskingParser.mask Error: The 'message' argument must be a string."
      );
    }

    // Initialize the variable to hold the progressively masked message.
    // It starts as the original message and gets transformed by each transformer.
    let processedMessage = message;

    // Iterate through each transformer and apply their transform method.
    for (const transformer of this.transformers) {
      // Transform the message and get the transformer's state changes, ensuring no direct mutation of the shared state.
      const [transformedMessage, transformerState] =
        await transformer.transform(processedMessage, new Map(this.state));

      // Update the processed message for subsequent transformers.
      processedMessage = transformedMessage;

      // Merge state changes from the transformer into the parser's state.
      // This accumulates all transformations' effects on the state.
      transformerState.forEach((value, key) => this.state.set(key, value));
    }

    // Handle onMaskingEnd callback
    if (this.config.onMaskingEnd) {
      await this.config.onMaskingEnd(processedMessage);
    }
    // Return the fully masked message after all transformers have been applied.
    return processedMessage;
  }

  /**
   * Rehydrates a masked message back to its original form.
   * This method sequentially applies the rehydration logic of each added transformer in reverse order.
   * It relies on the state map to correctly map the masked values back to their original values.
   *
   * The rehydration process is essential for restoring the original content of a message
   * that has been transformed (masked) by the transformers. This process is the inverse of the masking process.
   *
   * @param message - The masked message to be rehydrated.
   * @returns The original (rehydrated) version of the message.
   */
  async rehydrate(
    message: string,
    state?: Map<string, string>
  ): Promise<string> {
    // Handle onRehydratingStart callback
    if (this.config.onRehydratingStart) {
      await this.config.onRehydratingStart(message);
    }

    if (typeof message !== "string") {
      throw new TypeError(
        "MaskingParser.rehydrate Error: The 'message' argument must be a string."
      );
    }
    // Check if any transformers have been added to the parser.
    // If no transformers are present, throw an error as rehydration requires at least one transformer.
    if (this.transformers.length === 0) {
      throw new Error(
        "MaskingParser.rehydrate Error: No transformers have been added. Please add at least one transformer before rehydrating."
      );
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (state && !(state instanceof Map)) {
      throw new TypeError(
        "MaskingParser.rehydrate Error: The 'state' argument, if provided, must be an instance of Map."
      );
    }

    const rehydrationState = state || this.state; // Use provided state or fallback to internal state
    // Initialize the rehydratedMessage with the input masked message.
    // This variable will undergo rehydration by each transformer in reverse order.
    let rehydratedMessage = message;
    // Use a reverse for...of loop to accommodate asynchronous rehydrate methods
    const reversedTransformers = this.transformers.slice().reverse();
    for (const transformer of reversedTransformers) {
      // Check if the result is a Promise and use await, otherwise use it directly
      rehydratedMessage = await transformer.rehydrate(
        rehydratedMessage,
        rehydrationState
      );
    }

    // Handle onRehydratingEnd callback
    if (this.config.onRehydratingEnd) {
      await this.config.onRehydratingEnd(rehydratedMessage);
    }

    // Return the fully rehydrated message after all transformers have been applied.
    return rehydratedMessage;
  }
}

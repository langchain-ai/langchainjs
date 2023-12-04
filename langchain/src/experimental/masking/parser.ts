import { MaskingTransformer } from "./transformer.js";
import { MaskingParserConfig } from "./types.js";

/**
 * MaskingParser class for handling the masking and rehydrating of messages.
 */
export class MaskingParser {
  private transformers: MaskingTransformer[];
  private state: Map<string, string>;
  private config: MaskingParserConfig;

  constructor(config: MaskingParserConfig = {}) {
    this.transformers = config.transformers || [];
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
  async parse(message: string): Promise<string> {
    this.config.onMaskingStart?.(message);

    // Check if there are any transformers added to the parser. If not, throw an error
    // as masking requires at least one transformer to apply its logic.
    if (this.transformers.length === 0) {
      throw new Error(
        "MaskingParser.parse Error: No transformers have been added. Please add at least one transformer before parsing."
      );
    }

    if (typeof message !== "string") {
      throw new TypeError(
        "MaskingParser.parse Error: The 'message' argument must be a string."
      );
    }

    // Initialize the variable to hold the progressively masked message.
    // It starts as the original message and gets transformed by each transformer.
    let processedMessage = message;

    // Iterate through each transformer added to the parser.
    this.transformers.forEach((transformer) => {
      // Apply the transformer's transform method to the current state of the message.
      // The transform method returns a tuple containing the updated message and state.
      // The state is a map that tracks the original values of masked content.
      // This state is essential for the rehydration process to restore the original message.
      [processedMessage, this.state] = transformer.transform(
        processedMessage,
        this.state
      );
    });

    this.config.onMaskingEnd?.(processedMessage);
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
    this.config.onRehydratingStart?.(message);

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

    if (state && !(state instanceof Map)) {
      throw new TypeError(
        "MaskingParser.rehydrate Error: The 'state' argument, if provided, must be an instance of Map."
      );
    }

    const rehydrationState = state || this.state; // Use provided state or fallback to internal state
    // Initialize the rehydratedMessage with the input masked message.
    // This variable will undergo rehydration by each transformer in reverse order.
    let rehydratedMessage = message;
    this.transformers
      .slice()
      .reverse()
      .forEach((transformer) => {
        // Apply the transformer's rehydrate method to the current state of the message.
        // The rehydrate method uses the stored state (this.state) to map masked values
        // back to their original values, effectively undoing the masking transformation.
        rehydratedMessage = transformer.rehydrate(
          rehydratedMessage,
          rehydrationState
        );
      });

    this.config.onRehydratingEnd?.(rehydratedMessage);
    // Return the fully rehydrated message after all transformers have been applied.
    return rehydratedMessage;
  }
}

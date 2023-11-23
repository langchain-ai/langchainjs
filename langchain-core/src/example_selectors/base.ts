import { Serializable } from "../load/serializable.js";
import type { Example } from "../prompts/base.js";

/**
 * Base class for example selectors.
 */
export abstract class BaseExampleSelector extends Serializable {
  lc_namespace = ["langchain_core", "example_selectors", "base"];

  /**
   * Adds an example to the example selector.
   * @param example The example to add to the example selector.
   * @returns A Promise that resolves to void or a string.
   */
  abstract addExample(example: Example): Promise<void | string>;

  /**
   * Selects examples from the example selector given the input variables.
   * @param input_variables The input variables to select examples with.
   * @returns A Promise that resolves to an array of selected examples.
   */
  abstract selectExamples(input_variables: Example): Promise<Example[]>;
}

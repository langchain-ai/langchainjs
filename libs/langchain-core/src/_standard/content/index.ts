import type { BaseContentBlock } from "./base.js";
import type { Tools } from "./tools.js";
import type { Multimodal } from "./multimodal.js";

export type MessageContent = string | Array<BaseContentBlock>;

export type ContentBlock = BaseContentBlock;

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace ContentBlock {
  /**
   * Annotation for citing data from a document.
   */
  export interface Citation {
    /**
     * Type of the content block
     */
    readonly type: "citation";
    /**
     * URL of the document source
     */
    url?: string;
    /**
     * Source document title.
     *
     * For example, the page title for a web page or the title of a paper.
     */
    title?: string;
    /**
     * Start index of the **response text** for which the annotation applies.
     *
     * @see {Text}
     */
    startIndex?: number;
    /**
     * End index of the **response text** for which the annotation applies.
     *
     * @see {Text}
     */
    endIndex?: number;
    /**
     * Excerpt of source text being cited.
     */
    citedText?: string;
  }

  /**
   * Text output from a LLM.
   *
   * This typically represents the main text content of a message, such as the response
   * from a language model or the text of a user message.
   */
  export interface Text extends ContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "text";
    /**
     * Block text.
     */
    text: string;
    /**
     * Index of block in aggregate response. Used during streaming.
     */
    index?: number;
    /**
     * Citations and other annotations.
     */
    annotations?: Citation[];
  }

  /**
   * Reasoning output from a LLM.
   */
  export interface Reasoning extends ContentBlock {
    /**
     * Type of the content block
     */
    readonly type: "reasoning";
    /**
     * Reasoning text.
     *
     * Either the thought summary or the raw reasoning text itself.
     * This is often parsed from `<think>` tags in the model's response.
     */
    reasoning: string;
    /**
     * Index of block in aggregate response. Used during streaming.
     */
    index?: number;
  }

  export { Tools };
  export { Multimodal };
  export type Standard =
    | Text
    | Reasoning
    | Tools.ContentBlock
    | Multimodal.ContentBlock;
}

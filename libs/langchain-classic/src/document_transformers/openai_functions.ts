import {
  Document,
  MappingDocumentTransformer,
} from "@langchain/core/documents";
import { ChatOpenAI } from "@langchain/openai";
import { InteropZodObject } from "@langchain/core/utils/types";
import {
  type JsonSchema7ObjectType,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import { BaseChain } from "../chains/base.js";
import {
  TaggingChainOptions,
  createTaggingChain,
} from "../chains/openai_functions/index.js";

/**
 * A transformer that tags metadata to a document using a tagging chain.
 */
export class MetadataTagger extends MappingDocumentTransformer {
  static lc_name() {
    return "MetadataTagger";
  }

  protected taggingChain: BaseChain;

  constructor(fields: { taggingChain: BaseChain }) {
    super();
    this.taggingChain = fields.taggingChain;
    if (this.taggingChain.inputKeys.length !== 1) {
      throw new Error(
        "Invalid input chain. The input chain must have exactly one input."
      );
    }
    if (this.taggingChain.outputKeys.length !== 1) {
      throw new Error(
        "Invalid input chain. The input chain must have exactly one output."
      );
    }
  }

  async _transformDocument(document: Document): Promise<Document> {
    const taggingChainResponse = await this.taggingChain.call({
      [this.taggingChain.inputKeys[0]]: document.pageContent,
    });
    const extractedMetadata =
      taggingChainResponse[this.taggingChain.outputKeys[0]];
    return new Document({
      pageContent: document.pageContent,
      metadata: { ...extractedMetadata, ...document.metadata },
    });
  }
}

export function createMetadataTagger(
  schema: JsonSchema7ObjectType,
  options: TaggingChainOptions & { llm?: ChatOpenAI }
) {
  const { llm = new ChatOpenAI({ model: "gpt-3.5-turbo-0613" }), ...rest } =
    options;
  const taggingChain = createTaggingChain(schema, llm, rest);
  return new MetadataTagger({ taggingChain });
}

export function createMetadataTaggerFromZod(
  schema: InteropZodObject,
  options: TaggingChainOptions & { llm?: ChatOpenAI }
) {
  return createMetadataTagger(
    toJsonSchema(schema) as JsonSchema7ObjectType,
    options
  );
}

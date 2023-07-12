import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";

import { Document } from "../document.js";
import { BaseChain } from "../chains/base.js";
import { BaseDocumentTransformer } from "../schema/document.js";
import {
  TaggingChainOptions,
  createTaggingChain,
} from "../chains/openai_functions/index.js";
import { ChatOpenAI } from "../chat_models/openai.js";

export class MetadataTagger extends BaseDocumentTransformer {
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

  async transformDocuments(documents: Document[]): Promise<Document[]> {
    const newDocuments = [];
    for (const document of documents) {
      const taggingChainResponse = await this.taggingChain.call({
        [this.taggingChain.inputKeys[0]]: document.pageContent,
      });
      const extractedMetadata =
        taggingChainResponse[this.taggingChain.outputKeys[0]];
      const newDocument = new Document({
        pageContent: document.pageContent,
        metadata: { ...extractedMetadata, ...document.metadata },
      });
      newDocuments.push(newDocument);
    }
    return newDocuments;
  }
}

export function createMetadataTagger(
  schema: JsonSchema7ObjectType,
  options: TaggingChainOptions & { llm?: ChatOpenAI }
) {
  const { llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613" }), ...rest } =
    options;
  const taggingChain = createTaggingChain(schema, llm, rest);
  return new MetadataTagger({ taggingChain });
}

export function createMetadataTaggerFromZod(
  schema: z.AnyZodObject,
  options: TaggingChainOptions & { llm?: ChatOpenAI }
) {
  return createMetadataTagger(
    zodToJsonSchema(schema) as JsonSchema7ObjectType,
    options
  );
}

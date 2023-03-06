import { Document } from "document.js";
import { Embeddings } from "embeddings/base.js";
import { VectorStore } from "vectorstores/base.js";
import type { BaseExampleSelector, Example } from "../base.js";

function sortedValues(values: Record<string, string>): string[] {
  return Object.keys(values)
    .sort()
    .map((key) => values[key]);
}

export class SemanticSimilarityExampleSelector implements BaseExampleSelector {
  static examples?: unknown[];

  vectorstore: VectorStore;

  k = 4;

  example_keys?: string[];

  input_keys?: string[];

  constructor(data: {
    vectorstore: VectorStore;
    k?: number;
    example_keys?: string[];
    input_keys?: string[];
  }) {
    this.vectorstore = data.vectorstore;
    this.k = data.k ?? 4;
    this.example_keys = data.example_keys;
    this.input_keys = data.input_keys;
  }

  async addExample(example: Record<string, string>): Promise<void> {
    const inputKeys = this.input_keys ?? Object.keys(example);
    const stringExample = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: example[key] }),
        {} as Record<string, string>
      )
    ).join(" ");

    await this.vectorstore.addDocuments([
      new Document({
        pageContent: stringExample,
        metadata: { example },
      }),
    ]);

  }

  async selectExamples(
    inputVariables: Record<string, string>
  ): Promise<Example[]> {
    const inputKeys = this.input_keys ?? Object.keys(inputVariables);
    const query = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: inputVariables[key] }),
        {} as Record<string, string>
      )
    ).join(" ");

    const exampleDocs = await this.vectorstore.similaritySearch(query, this.k);

    const examples = exampleDocs.map((doc) => doc.metadata);
    if (this.example_keys) {
      // If example keys are provided, filter examples to those keys.
      return examples.map((example) =>
        (this.example_keys as string[]).reduce(
          (acc, key) => ({ ...acc, [key]: example[key] }),
          {}
        )
      );
    }
    return examples;
  }

  static async fromExamples(
    examples: Record<string, string>[],
    embeddings: Embeddings,
    vectorstoreCls: typeof VectorStore,
    options: {
      k?: number;
      inputKeys?: string[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    } = {}
  ): Promise<SemanticSimilarityExampleSelector> {
    const inputKeys = options.inputKeys ?? null;
    const stringExamples = examples.map((example) =>
      sortedValues(
        inputKeys
          ? inputKeys.reduce(
              (acc, key) => ({ ...acc, [key]: example[key] }),
              {} as Record<string, string>
            )
          : example
      ).join(" ")
    );

    const vectorstore = await vectorstoreCls.fromTexts(
      stringExamples,
      examples, // metadatas
      embeddings,
      options
    );

    return new SemanticSimilarityExampleSelector({
      vectorstore,
      k: options.k ?? 4,
      example_keys: options.exampleKeys,
      input_keys: options.inputKeys,
    });
  }
}

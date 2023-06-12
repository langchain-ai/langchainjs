import { Embeddings } from "../../embeddings/base.js";
import { VectorStore } from "../../vectorstores/base.js";
import { Document } from "../../document.js";
import { Example } from "../../schema/index.js";
import { BaseExampleSelector } from "../base.js";

function sortedValues<T>(values: Record<string, T>): T[] {
  return Object.keys(values)
    .sort()
    .map((key) => values[key]);
}

export interface SemanticSimilarityExampleSelectorInput {
  vectorStore: VectorStore;
  k?: number;
  exampleKeys?: string[];
  inputKeys?: string[];
}

export class SemanticSimilarityExampleSelector extends BaseExampleSelector {
  vectorStore: VectorStore;

  k = 4;

  exampleKeys?: string[];

  inputKeys?: string[];

  constructor(data: SemanticSimilarityExampleSelectorInput) {
    super(data);
    this.vectorStore = data.vectorStore;
    this.k = data.k ?? 4;
    this.exampleKeys = data.exampleKeys;
    this.inputKeys = data.inputKeys;
  }

  async addExample(example: Example): Promise<void> {
    const inputKeys = this.inputKeys ?? Object.keys(example);
    const stringExample = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: example[key] }),
        {} as Example
      )
    ).join(" ");

    await this.vectorStore.addDocuments([
      new Document({
        pageContent: stringExample,
        metadata: { example },
      }),
    ]);
  }

  async selectExamples<T>(
    inputVariables: Record<string, T>
  ): Promise<Example[]> {
    const inputKeys = this.inputKeys ?? Object.keys(inputVariables);
    const query = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: inputVariables[key] }),
        {} as Record<string, T>
      )
    ).join(" ");

    const exampleDocs = await this.vectorStore.similaritySearch(query, this.k);

    const examples = exampleDocs.map((doc) => doc.metadata);
    if (this.exampleKeys) {
      // If example keys are provided, filter examples to those keys.
      return examples.map((example) =>
        (this.exampleKeys as string[]).reduce(
          (acc, key) => ({ ...acc, [key]: example[key] }),
          {}
        )
      );
    }
    return examples;
  }

  static async fromExamples<C extends typeof VectorStore>(
    examples: Record<string, string>[],
    embeddings: Embeddings,
    vectorStoreCls: C,
    options: {
      k?: number;
      inputKeys?: string[];
    } & Parameters<C["fromTexts"]>[3] = {}
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

    const vectorStore = await vectorStoreCls.fromTexts(
      stringExamples,
      examples, // metadatas
      embeddings,
      options
    );

    return new SemanticSimilarityExampleSelector({
      vectorStore,
      k: options.k ?? 4,
      exampleKeys: options.exampleKeys,
      inputKeys: options.inputKeys,
    });
  }
}

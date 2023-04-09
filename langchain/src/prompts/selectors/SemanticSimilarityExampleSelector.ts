import { Embeddings } from "../../embeddings/base.js";
import { VectorStore } from "../../vectorstores/base.js";
import { Document } from "../../document.js";
import { Example } from "../../schema/index.js";
import type { BaseExampleSelector } from "../base.js";

function sortedValues<T>(values: Record<string, T>): T[] {
  return Object.keys(values)
    .sort()
    .map((key) => values[key]);
}

export class SemanticSimilarityExampleSelector<
  K extends string,
  P extends string
> implements BaseExampleSelector<K, P>
{
  vectorStore: VectorStore;

  k = 4;

  exampleKeys?: (K | P)[];

  inputKeys?: (K | P)[];

  constructor(data: {
    vectorStore: VectorStore;
    k?: number;
    exampleKeys?: (K | P)[];
    inputKeys?: (K | P)[];
  }) {
    this.vectorStore = data.vectorStore;
    this.k = data.k ?? 4;
    this.exampleKeys = data.exampleKeys;
    this.inputKeys = data.inputKeys;
  }

  async addExample(example: Example<K, P>): Promise<void> {
    const inputKeys = this.inputKeys ?? (Object.keys(example) as (K | P)[]);
    const stringExample = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: example[key] }),
        {} as Example<K, P>
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
  ): Promise<Example<K, P>[]> {
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
      ) as Example<K, P>[];
    }
    return examples;
  }

  static async fromExamples<
    C extends typeof VectorStore,
    K extends string,
    P extends string
  >(
    examples: Record<string, string>[],
    embeddings: Embeddings,
    vectorStoreCls: C,
    options: {
      k?: number;
      inputKeys?: (K | P)[];
    } & Parameters<C["fromTexts"]>[3] = {}
  ): Promise<SemanticSimilarityExampleSelector<K, P>> {
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

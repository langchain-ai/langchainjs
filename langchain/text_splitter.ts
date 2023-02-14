import { Document } from "./document";

interface TextSplitterInterface {
  splitText(text: string): string[];
  createDocuments(
    texts: string[],
    metadatas?: Record<string, any>[]
  ): Document[];
  splitDocuments(documents: Document[]): Document[];
}

abstract class TextSplitter implements TextSplitterInterface {
  protected readonly chunkSize: number;

  protected readonly chunkOverlap: number;

  protected readonly lengthFunction: (s: string) => number;

  constructor(
    chunkSize = 4000,
    chunkOverlap = 200,
    lengthFunction: (s: string) => number = (s) => s.length
  ) {
    if (chunkOverlap > chunkSize) {
      throw new Error(
        `Got a larger chunk overlap (${chunkOverlap}) than chunk size +
(${chunkSize}), should be smaller.`
      );
    }
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.lengthFunction = lengthFunction;
  }

  abstract splitText(text: string): string[];

  createDocuments(
    texts: string[],
    metadatas: Record<string, any>[] = []
  ): Document[] {
    const _metadatas =
      metadatas.length > 0 ? metadatas : new Array(texts.length).fill({});
    const documents = new Array<Document>();
    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i];
      for (const chunk of this.splitText(text)) {
        documents.push(new Document(chunk, "", 0, _metadatas[i]));
      }
    }
    return documents;
  }

  splitDocuments(documents: Document[]): Document[] {
    const texts = documents.map((doc) => doc.pageContent);
    const metadatas = documents.map((doc) => doc.metadata);
    return this.createDocuments(texts, metadatas);
  }

  private joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;
    for (const d of splits) {
      const _len = this.lengthFunction(d);
      if (total + _len >= this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(
            `Created a chunk of size ${total}, +
which is longer than the specified ${this.chunkSize}`
          );
        }
        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator);
          if (doc !== null) {
            docs.push(doc);
          }
          // Keep on popping if:
          // - we have a larger chunk than in the chunk overlap
          // - or if we still have any chunks and the length is long
          while (
            total > this.chunkOverlap ||
            (total + _len > this.chunkSize && total > 0)
          ) {
            total -= this.lengthFunction(currentDoc[0]);
            currentDoc.shift();
          }
        }
      }
      currentDoc.push(d);
      total += _len;
    }
    const doc = this.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
    return docs;
  }
}

export class CharacterTextSplitter extends TextSplitter {
  private readonly separator: string;

  constructor(separator = "\n\n", kwargs: any = {}) {
    super(kwargs);
    this.separator = separator;
  }

  public splitText(text: string): string[] {
    // First we naively split the large input into a bunch of smaller ones.
    let splits: string[];
    if (this.separator) {
      splits = text.split(this.separator);
    } else {
      splits = text.split("");
    }
    return this.mergeSplits(splits, this.separator);
  }
}

export class RecursiveCharacterTextSplitter extends TextSplitter {
  private _separators: string[];

  constructor(separators: string[] = ["\n\n", "\n", " ", ""], ...kwargs: any) {
    super(kwargs);
    this._separators = separators;
  }

  splitText(text: string): string[] {
    const finalChunks: string[] = [];

    // Get appropriate separator to use
    let separator: string = this._separators[this._separators.length - 1];
    for (const s of this._separators) {
      if (s === "") {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        break;
      }
    }

    // Now that we have the separator, split the text
    let splits: string[];
    if (separator) {
      splits = text.split(separator);
    } else {
      splits = text.split("");
    }

    // Now go merging things, recursively splitting longer texts.
    let goodSplits: string[] = [];
    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length) {
          const mergedText = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        const otherInfo = this.splitText(s);
        finalChunks.push(...otherInfo);
      }
    }
    if (goodSplits.length) {
      const mergedText = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...mergedText);
    }
    return finalChunks;
  }
}

import { Document } from "./document";

interface TextSplitterInterface {
  split_text(text: string): string[];
  create_documents(texts: string[], metadatas?: Record<string, any>[]): Document[];
  split_documents(documents: Document[]): Document[];
}

abstract class TextSplitter implements TextSplitterInterface {
  protected readonly _chunk_size: number;

  protected readonly _chunk_overlap: number;

  protected readonly _length_function: (s: string) => number;

  constructor(
    chunk_size = 4000,
    chunk_overlap = 200,
    length_function: (s: string) => number = (s) => s.length,
  ) {
    if (chunk_overlap > chunk_size) {
      throw new Error(
        `Got a larger chunk overlap (${chunk_overlap}) than chunk size ` +
        `(${chunk_size}), should be smaller.`,
      );
    }
    this._chunk_size = chunk_size;
    this._chunk_overlap = chunk_overlap;
    this._length_function = length_function;
  }

  abstract split_text(text: string): string[];

  create_documents(texts: string[], metadatas: Record<string, any>[] = []): Document[] {
    const _metadatas = metadatas.length > 0 ? metadatas : new Array(texts.length).fill({});
    const documents = new Array<Document>();
    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i];
      for (const chunk of this.split_text(text)) {
        documents.push(new Document(chunk, "", 0, _metadatas[i]));
      }
    }
    return documents;
  }

  split_documents(documents: Document[]): Document[] {
    const texts = documents.map((doc) => doc.page_content);
    const metadatas = documents.map((doc) => doc.metadata);
    return this.create_documents(texts, metadatas);
  }

  private _join_docs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }

  _merge_splits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const current_doc: string[] = [];
    let total = 0;
    for (const d of splits) {
      const _len = this._length_function(d);
      if (total + _len >= this._chunk_size) {
        if (total > this._chunk_size) {
          console.warn(
            `Created a chunk of size ${total}, ` +
            `which is longer than the specified ${this._chunk_size}`
          );
        }
        if (current_doc.length > 0) {
          const doc = this._join_docs(current_doc, separator);
          if (doc !== null) {
            docs.push(doc);
          }
          // Keep on popping if:
          // - we have a larger chunk than in the chunk overlap
          // - or if we still have any chunks and the length is long
          while (
            total > this._chunk_overlap ||
            (total + _len > this._chunk_size && total > 0)
          ) {
            total -= this._length_function(current_doc[0]);
            current_doc.shift();
          }
        }
      }
      current_doc.push(d);
      total += _len;
    }
    const doc = this._join_docs(current_doc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
    return docs;
  }
}

export class CharacterTextSplitter extends TextSplitter {
  private readonly _separator: string;

  constructor(separator = "\n\n", kwargs: any = {}) {
    super(kwargs);
    this._separator = separator;
  }

  public split_text(text: string): string[] {
    // First we naively split the large input into a bunch of smaller ones.
    let splits: string[];
    if (this._separator) {
      splits = text.split(this._separator);
    } else {
      splits = text.split("");
    }
    return this._merge_splits(splits, this._separator);
  }
}

export class RecursiveCharacterTextSplitter extends TextSplitter {
    private _separators: string[];

    constructor(separators: string[] = ["\n\n", "\n", " ", ""], ...kwargs: any) {
        super(kwargs);
        this._separators = separators;
    }

    split_text(text: string): string[] {
        const final_chunks: string[] = [];

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
            splits = text.split('');
        }

        // Now go merging things, recursively splitting longer texts.
        let good_splits: string[] = [];
        for (const s of splits) {
            if (s.length < this._chunk_size) {
                good_splits.push(s);
            } else {
                if (good_splits.length) {
                    const merged_text = this._merge_splits(good_splits, separator);
                    final_chunks.push(...merged_text);
                    good_splits = [];
                }
                const other_info = this.split_text(s);
                final_chunks.push(...other_info);
            }
        }
        if (good_splits.length) {
            const merged_text = this._merge_splits(good_splits, separator);
            final_chunks.push(...merged_text);
        }
        return final_chunks;
    }
}
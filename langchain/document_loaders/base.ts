import { RecursiveCharacterTextSplitter, TextSplitter } from "../text_splitter";
import { Document } from "../document";

export interface DocumentLoader {
  load(): Promise<Document[]>;
  loadAndSplit(textSplitter?: TextSplitter): Promise<Document[]>;
}

export abstract class BaseDocumentLoader implements DocumentLoader {
  abstract load(): Promise<Document[]>;

  async loadAndSplit(
    splitter: TextSplitter = new RecursiveCharacterTextSplitter()
  ): Promise<Document[]> {
    const docs = await this.load();
    return splitter.splitDocuments(docs);
  }
}

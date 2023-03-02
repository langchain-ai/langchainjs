import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";
import type { DocumentLoader } from "./base.js";

export class UnstructuredBaseDocumentLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  constructor(public webPath: string, filepath: string) {
    super();
  }

  static async _partition(filename: string) {
    const buffer = await readFile(this.filePath);

    const data = new FormData();
    data.append("file", buffer);

    const response = await fetch(this.webPath, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
        "Accept": "application/json",
      },
      body: data,
    });

    elements = await response.json();
    return elements;
  }

  async scrape(): Promise<CheerioAPI> {
    return CheerioWebBaseLoader._scrape(this.webPath);
  }

  async load(): Promise<Document[]> {
    const elements = await _partition();

    documents = [];
    for (const element of elements) {
        metadata = element.metadata;
        metadata.category = element.type;
        documents.push(new Document({ pageContent: metadata.text, metadata }));
    }

    return documents;
  }
}

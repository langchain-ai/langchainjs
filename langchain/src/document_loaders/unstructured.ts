import { readFile } from "fs/promises";
import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";

export class UnstructuredBaseDocumentLoader extends BaseDocumentLoader
{
  constructor(public webPath: string, filePath: string) {
    super();
    this.filePath = filePath;
    this.webPath = webPath;
  }

  async _partition() {
    const buffer = await readFile(this.filePath);
    const blob = new Blob([buffer]);

    const data = new FormData();
    data.append("file", blob);

    const response = await fetch(this.webPath, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
        "Accept": "application/json",
      },
      body: data,
    });

    const elements = await response.json();
    return elements;
  }

  async load(): Promise<Document[]> {
    const elements = await this._partition();

    const documents = [];
    for (const element of elements) {
        const {metadata} = element;
        metadata.category = element.type;
        documents.push(new Document({ pageContent: metadata.text, metadata }));
    }

    return documents;
  }
}

import FormData from "form-data";
import fetch from "node-fetch";
import { createReadStream } from "fs";

import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";

export class UnstructuredBaseDocumentLoader extends BaseDocumentLoader {

  constructor(public webPath: string, public filePath: string) {
    super();
    this.filePath = filePath;

    this.webPath = webPath;
  }

  async _partition() {
    const fileStream = createReadStream(this.filePath);

    const form = new FormData();
    form.append('files', fileStream);

    const response = await fetch(this.webPath, {
      method: "POST",
      body: form,
    });

    const elements = await response.json();
    return elements;
  }

  async load(): Promise<Document[]> {
    const elements = await this._partition();

    const documents = [];
    // eslint-disable-next-line
    // @ts-ignore
    for (const element of elements) {
        const {metadata} = element.metadata;
        metadata.category = element.type;
        documents.push(new Document({ pageContent: metadata.text, metadata }));
    }

    return documents;
  }
}

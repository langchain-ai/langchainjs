import FormData from "form-data";
import fetch from "node-fetch";
import { createReadStream } from "fs";

// import { readFile } from "fs/promises";
import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";

export class UnstructuredBaseDocumentLoader extends BaseDocumentLoader {

  constructor(public webPath: string, public filePath: string) {
    super();
    this.filePath = filePath;

    this.webPath = webPath;
  }

  async _partition() {
    // const buffer = await readFile(this.filePath);
    // const blob = new Blob([buffer]);

    // const stats = statSync(self.filePath);
    // const fileSizeInBytes = stats.size;
    const fileStream = createReadStream(this.filePath);

    const form = new FormData();
    form.append('files', fileStream); // , { knownLength: fileSizeInBytes });

    const response = await fetch(this.webPath, {
      method: "POST",
      // headers: {
      //   "Content-Type": "multipart/form-data",
      //   "Accept": "application/json",
      // },
      body: form,
    });

    const elements = await response.json();
    return elements;
  }

  async load(): Promise<Document[]> {
    const elements = await this._partition();

    const documents = [];
    // @ts-ignore
    for (const element of elements) {
        const {metadata} = element.metadata;
        metadata.category = element.type;
        documents.push(new Document({ pageContent: metadata.text, metadata }));
    }

    return documents;
  }
}

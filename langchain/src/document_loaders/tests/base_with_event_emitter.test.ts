import { test, expect } from "@jest/globals";
import { BaseDocumentLoaderWithEventEmitter } from "../base_with_event_emitter.js";
import { Document } from "../../document.js";

class ExampleTextLoaderWithEvents extends BaseDocumentLoaderWithEventEmitter {
  private documentsTotal = 0;

  private documents: Document[] = [];

  constructor(public textArray: (string | string[])[]) {
    super();
  }

  private updateTotal(n?: number) {
    this.documentsTotal =
      n !== undefined ? this.documentsTotal + n : this.documentsTotal + 1;
    this.emit("update-total", this.documentsTotal);
  }

  private async parseText(text: string | string[]) {
    // Simulate async delay
    // await new Promise((resolve) => {
    //   setTimeout(resolve, 250);
    // });

    if (typeof text === "string") {
      const doc = new Document({
        pageContent: text,
        metadata: {
          contentLength: text.length,
        },
      });

      this.documents.push(doc);
      this.emit("load", this.documents.length);
    } else {
      this.updateTotal(text.length - 1);
      await Promise.all(text.map((text) => this.parseText(text)));
    }
  }

  public async load(): Promise<Document[]> {
    this.emit("begin");
    this.updateTotal(this.textArray.length);

    for (const text of this.textArray) {
      await this.parseText(text);
    }

    this.emit("end");
    return this.documents;
  }
}

test("Example text loader with events", async () => {
  const sampleData = [
    "The sky is blue.",
    "I love ea cake tasted delicious.",
    "I enjoy playing video games.",
    [
      "Visiting museums is a enriching experience.",
      "There's so much to learn.",
    ],
    "I need to do some grocery shopping.",
  ];

  const loader = new ExampleTextLoaderWithEvents(sampleData);

  let total = 0;
  loader.on("begin", () => console.log("It's begun"));
  loader.on("update-total", (documentTotal) => {
    total = documentTotal;
    console.log(`Total updated: ${documentTotal}`);
  });
  loader.on("load", (current) => console.log(`Loaded ${current}/${total}`));
  loader.on("end", () => console.log("It's ended"));

  const docs = await loader.load();

  expect(docs.length).toBe(6);
});

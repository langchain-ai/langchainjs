import { BaseDocumentLoaderWithEventEmitter } from "langchain/document_loaders/base_with_event_emitter";
import { Document } from "langchain/document";

class ExampleTextLoaderWithEvents extends BaseDocumentLoaderWithEventEmitter {
  private documentsTotal: number = 0;

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
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });

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

const sampleData = [
  "The sky is blue.",
  "I love ea cake tasted delicious.",
  "I enjoy playing video games.",
  ["Visiting museums is a enriching experience.", "There's so much to learn."],
  "I need to do some grocery shopping.",
  "I went for a run in the park.",
  "Listening to the sound of waves is calming.",
  "I love taking photographs to capture memories.",
  "eating pizza.",
  "Football is my favorite sport.",
  "The cat chased the mouse.",
  "I enjoy reading mystery novels.",
  "Coffee keeps me awake.",
  "My car broke down yesterday.",
  ["The sun is shining.", "It's a beautiful day."],
  "I like listening to music.",
  ["I prefer summer over winter.", "I enjoy swimming and sunbathing."],
  "I took a long walk in the park.",
  "Watching movies is a favorite pastime.",
  "The dog wagged its tail happily.",
  "I am going on vacation tomorrow.",
  "Learning new things is exciting.",
  "The rain gave life to the flowers.",
  "I couldn't stop laughing at the comedian's jokes.",
  "Going to the beach is always fun.",
  ["Hiking in the mountains is breathtaking.", "The view is spectacular."],
  ["Cooking is a great way to relax.", "I enjoy trying new recipes."],
  "I woke up early this morning.",
  "Reading a book before bed helps me relax.",
  "I bought a new laptop today.",
  "I love spending time with my family.",
  "The cake tasted delicious.",
  "I enjoy playing video games.",
  ["Visiting museums is a enriching experience.", "There's so much to learn."],
  "I need to do some grocery shopping.",
  "I went for a run in the park.",
  "Listening to the sound of waves is calming.",
  "I love taking photographs to capture memories.",
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

console.log("Documents:", docs);

import { Document } from "../../documents/document.js";
import { BaseRetriever } from "../../retrievers/index.js";

export class FakeRetriever extends BaseRetriever {
  lc_namespace = ["test", "fake"];

  output = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
  ];

  constructor(fields?: { output: Document[] }) {
    super();
    this.output = fields?.output ?? this.output;
  }

  async _getRelevantDocuments(
    _query: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Document<Record<string, any>>[]> {
    return this.output;
  }
}

export class Document {
  pageContent: string;

  lookupStr: string;

  lookupIndex = 0;

  metadata: Record<string, any>;

  constructor(
    pageContent: string,
    lookupStr = "",
    lookupIndex = 0,
    metadata: Record<string, any> = {}
  ) {}

  get paragraphs(): string[] {
    return this.pageContent.split("\n\n");
  }

  get summary(): string {
    return this.paragraphs[0];
  }

  lookup(string: string): string {
    if (string.toLowerCase() !== this.lookupStr) {
      this.lookupStr = string.toLowerCase();
      this.lookupIndex = 0;
    } else {
      this.lookupIndex += 1;
    }
    const lookups = this.paragraphs.filter((p) =>
      p.toLowerCase().includes(this.lookupStr)
    );
    if (lookups.length === 0) {
      return "No Results";
    }
    if (this.lookupIndex >= lookups.length) {
      return "No More Results";
    }
    const result_prefix = `(Result ${this.lookupIndex + 1}/${lookups.length})`;
    return `${result_prefix} ${lookups[this.lookupIndex]}`;
  }
}

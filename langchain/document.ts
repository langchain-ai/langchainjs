export class Document {
  page_content: string;

  lookup_str: string;

  lookup_index: number;

  metadata: Record<string, any>;

  constructor(
    page_content: string,
    lookup_str = "",
    lookup_index = 0,
    metadata: Record<string, any> = {}
  ) {}
    
  get paragraphs(): string[] {
    return this.page_content.split("\n\n");
  }

  get summary(): string {
    return this.paragraphs[0];
  }

  lookup(string: string): string {
    if (string.toLowerCase() !== this.lookup_str) {
      this.lookup_str = string.toLowerCase();
      this.lookup_index = 0;
    } else {
      this.lookup_index += 1;
    }
    const lookups = this.paragraphs.filter((p) => p.toLowerCase().includes(this.lookup_str));
    if (lookups.length === 0) {
      return "No Results";
    } if (this.lookup_index >= lookups.length) {
      return "No More Results";
    } 
      const result_prefix = `(Result ${this.lookup_index + 1}/${lookups.length})`;
      return `${result_prefix} ${lookups[this.lookup_index]}`;
    
  }
}

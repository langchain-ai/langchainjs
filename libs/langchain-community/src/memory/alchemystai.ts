import AlchemystAI from "@alchemystai/sdk";
import { BaseChatMemory, BaseChatMemoryInput } from "@langchain/core/memory";

export interface AlchemystMemoryInput extends BaseChatMemoryInput {
  apiKey: string;
  sessionId: string;
  baseURL?: string;
}

export class AlchemystMemory extends BaseChatMemory {
  private client: AlchemystAI;
  private sessionId: string;

  constructor(fields: AlchemystMemoryInput) {
    super(fields);
    this.sessionId = fields.sessionId;
    this.client = new AlchemystAI({
      apiKey: fields.apiKey,
    });
  }

  async loadMemoryVariables(_values: Record<string, any>) {
    try {
      const query = typeof _values?.input === "string" && _values.input.trim() ? _values.input : "conversation";
      const res: any = await this.client.v1.context.search({
        query,
        similarity_threshold: 0.0,
        minimum_similarity_threshold: 0.0,
        scope: "internal",
        metadata: null,
      });
      const contexts = Array.isArray(res?.contexts) ? res.contexts : [];
      const items = contexts
        .map((c: any) => c?.content)
        .filter(Boolean);
      return { history: items.join("\n") };
    } catch (error) {
      console.log("Error loading memory variables:", error);
      return { history: "" };
    }
  }

  async saveContext(input: Record<string, any>, output: Record<string, any>) {
    const user = String(input.input ?? "");
    const ai = String(output.output ?? "");
    const contents: Array<{ content: string, metadata: { source: string, messageId: string, type: string } }> = [];
    const timestamp = Date.now();
    if (user) contents.push({ content: user, metadata: { source: this.sessionId, messageId: String(timestamp), type: "text" } });
    if (ai) contents.push({ content: ai, metadata: { source: this.sessionId, messageId: String(timestamp + 1), type: "text" } });
    console.log("Saving context:", contents);
    if (contents.length === 0) return;

    try {
      await this.client.v1.context.memory.add({
        memoryId: this.sessionId,
        contents,
      });
    } catch (error) {
      console.log("Error saving context:", error);
    }
  }

  async clear() {
    try {
      await this.client.v1.context.memory.delete({
        memoryId: this.sessionId,
      });
    } catch (_err) {
    }
  }

  get memoryKeys(): string[] {
    return ["history"];
  }
}

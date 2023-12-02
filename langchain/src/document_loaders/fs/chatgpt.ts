import { TextLoader } from "./text.js";
import { Document } from "../../document.js";

interface ChatGPTMessage {
  author: {
    role: string;
  };
  content: {
    parts: string[];
  };
  create_time: number;
}

interface ChatGPTLog {
  title: string;
  mapping: Record<string, { message: ChatGPTMessage }>;
}

function concatenateRows(message: ChatGPTMessage, title: string): string {
  /**
   * Combine message information in a readable format ready to be used.
   * @param {ChatGPTMessage} message - Message to be concatenated
   * @param {string} title - Title of the conversation
   *
   * @returns {string} Concatenated message
   */
  if (!message) {
    return "";
  }

  const sender = message.author ? message.author.role : "unknown";
  const text = message.content.parts[0];
  const date = new Date(message.create_time * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  return `${title} - ${sender} on ${date}: ${text}\n\n`;
}

export class ChatGPTLoader extends TextLoader {
  public numLogs: number;

  constructor(filePathOrBlob: string | Blob, numLogs = 0) {
    super(filePathOrBlob);
    this.numLogs = numLogs;
  }

  protected async parse(raw: string): Promise<string[]> {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(e);
      throw new Error("Failed to parse JSON");
    }

    const truncatedData = this.numLogs > 0 ? data.slice(0, this.numLogs) : data;

    return truncatedData.map((d: ChatGPTLog) =>
      Object.values(d.mapping)
        .filter(
          (msg, idx) => !(idx === 0 && msg.message.author.role === "system")
        )
        .map((msg) => concatenateRows(msg.message, d.title))
        .join("")
    );
  }

  public async load(): Promise<Document[]> {
    let text: string;
    let metadata: Record<string, string>;
    if (typeof this.filePathOrBlob === "string") {
      const { readFile } = await TextLoader.imports();
      try {
        text = await readFile(this.filePathOrBlob, "utf8");
      } catch (e) {
        console.error(e);
        throw new Error("Failed to read file");
      }
      metadata = { source: this.filePathOrBlob };
    } else {
      try {
        text = await this.filePathOrBlob.text();
      } catch (e) {
        console.error(e);
        throw new Error("Failed to read blob");
      }
      metadata = { source: "blob", blobType: this.filePathOrBlob.type };
    }

    const parsed = await this.parse(text);
    return parsed.map(
      (pageContent, i) =>
        new Document({
          pageContent,
          metadata: {
            ...metadata,
            logIndex: i + 1,
          },
        })
    );
  }
}

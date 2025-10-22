import type { readFile as ReadFileT } from "node:fs/promises";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { getEnv } from "@langchain/core/utils/env";

export type ChatSession = {
  messages: BaseMessage[];
  // Reserved for future parity with Python ChatSession
  // functions?: Array<Record<string, unknown>>;
};

/**
 * Loader for WhatsApp chat export .txt files (without media).
 *
 * Parity with Python implementation:
 * - Single regex with optional brackets and leading LRM
 * - Slash-separated dates, 12-hour times with seconds and AM/PM
 * - Multi-line messages joined with a single space
 * - Exact ignore list and LRM-tolerant matching
 */
export class WhatsAppChatLoader {
  constructor(public filePathOrBlob: string | Blob) {}

  async load(): Promise<ChatSession[]> {
    const sessions: ChatSession[] = [];
    for await (const session of this.lazyLoad()) {
      sessions.push(session);
    }
    return sessions;
  }

  async *lazyLoad(): AsyncGenerator<ChatSession> {
    const text = await this.readAllText();
    yield this.parse(text);
  }

  protected parse(raw: string): ChatSession {
    const messages: BaseMessage[] = [];

    const ignoreLines = [
      "This message was deleted",
      "<Media omitted>",
      "image omitted",
      "Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.",
    ];
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ignoreRe = new RegExp(
      `(${ignoreLines.map((s) => `\\u200E*${escapeRe(s)}`).join("|")})`,
      "i"
    );

    const messageLineRe = new RegExp(
      String.raw`^\u200E*\[?(\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}:\d{2} (?:AM|PM))\]?[ \u200E]*([^:]+): (.+)$`,
      "i"
    );

    // Split messages by newlines but keep multi-line messages grouped
    const chatLines: string[] = [];
    let currentMessage = "";
    for (const line of raw.split("\n")) {
      if (messageLineRe.test(line)) {
        if (currentMessage) chatLines.push(currentMessage);
        currentMessage = line;
      } else {
        currentMessage += ` ${line.trim()}`;
      }
    }
    if (currentMessage) chatLines.push(currentMessage);

    for (const line of chatLines) {
      const result = messageLineRe.exec(line.trim());
      if (result) {
        const [, timestamp, sender, text] = result;
        if (!ignoreRe.test(text.trim())) {
          messages.push(
            new HumanMessage({
              content: text,
              name: sender,
              additional_kwargs: {
                sender,
                events: [{ message_time: timestamp }],
              },
            })
          );
        }
      } else {
        // Mirror Python's debug logging for unparsable lines
        console.debug(`Could not parse line: ${line}`);
      }
    }

    return { messages };
  }

  protected async readAllText(): Promise<string> {
    if (typeof this.filePathOrBlob === "string") {
      const { readFile } = await WhatsAppChatLoader.imports();
      try {
        return await readFile(this.filePathOrBlob, "utf8");
      } catch (e) {
        console.error(e);
        throw new Error("Failed to read file");
      }
    } else {
      try {
        return await this.filePathOrBlob.text();
      } catch (e) {
        console.error(e);
        throw new Error("Failed to read blob");
      }
    }
  }

  static async imports(): Promise<{
    readFile: typeof ReadFileT;
  }> {
    try {
      const { readFile } = await import("node:fs/promises");
      return { readFile };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. WhatsAppChatLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'.`
      );
    }
  }
}

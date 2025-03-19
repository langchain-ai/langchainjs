import { gmail_v1 } from "googleapis";
import { z } from "zod";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";
import { SEARCH_DESCRIPTION } from "./descriptions.js";

export class GmailSearch extends GmailBaseTool {
  name = "search_gmail";

  schema = z.object({
    query: z.string(),
    maxResults: z.number().optional(),
    resource: z.enum(["messages", "threads"]).optional(),
  });

  description = SEARCH_DESCRIPTION;

  constructor(fields?: GmailBaseToolParams) {
    super(fields);
  }

  async _call(arg: z.output<typeof this.schema>) {
    const { query, maxResults = 10, resource = "messages" } = arg;

    const response = await this.gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    const { data } = response;

    if (!data) {
      throw new Error("No data returned from Gmail");
    }

    const { messages } = data;

    if (!messages) {
      throw new Error("No messages returned from Gmail");
    }

    if (resource === "messages") {
      const parsedMessages = await this.parseMessages(messages);
      return `Result for the query ${query}:\n${JSON.stringify(
        parsedMessages
      )}`;
    } else if (resource === "threads") {
      const parsedThreads = await this.parseThreads(messages);
      return `Result for the query ${query}:\n${JSON.stringify(parsedThreads)}`;
    }

    throw new Error(`Invalid resource: ${resource}`);
  }

  async parseMessages(
    messages: gmail_v1.Schema$Message[]
  ): Promise<gmail_v1.Schema$Message[]> {
    const parsedMessages = await Promise.all(
      messages.map(async (message) => {
        const messageData = await this.gmail.users.messages.get({
          userId: "me",
          format: "raw",
          id: message.id ?? "",
        });

        const headers = messageData.data.payload?.headers || [];

        const subject = headers.find((header) => header.name === "Subject");
        const sender = headers.find((header) => header.name === "From");

        let body = "";
        if (messageData.data.payload?.parts) {
          body = messageData.data.payload.parts
            .map((part) => part.body?.data ?? "")
            .join("");
        } else if (messageData.data.payload?.body?.data) {
          body = messageData.data.payload.body.data;
        }

        return {
          id: message.id,
          threadId: message.threadId,
          snippet: message.snippet,
          body,
          subject,
          sender,
        };
      })
    );
    return parsedMessages;
  }

  async parseThreads(
    threads: gmail_v1.Schema$Thread[]
  ): Promise<gmail_v1.Schema$Thread[]> {
    const parsedThreads = await Promise.all(
      threads.map(async (thread) => {
        const threadData = await this.gmail.users.threads.get({
          userId: "me",
          format: "raw",
          id: thread.id ?? "",
        });

        const headers = threadData.data.messages?.[0]?.payload?.headers || [];

        const subject = headers.find((header) => header.name === "Subject");
        const sender = headers.find((header) => header.name === "From");

        let body = "";
        if (threadData.data.messages?.[0]?.payload?.parts) {
          body = threadData.data.messages[0].payload.parts
            .map((part) => part.body?.data ?? "")
            .join("");
        } else if (threadData.data.messages?.[0]?.payload?.body?.data) {
          body = threadData.data.messages[0].payload.body.data;
        }

        return {
          id: thread.id,
          snippet: thread.snippet,
          body,
          subject,
          sender,
        };
      })
    );
    return parsedThreads;
  }
}

export type SearchSchema = {
  query: string;
  maxResults?: number;
  resource?: "messages" | "threads";
};

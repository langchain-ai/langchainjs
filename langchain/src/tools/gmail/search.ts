import { gmail_v1, google } from "googleapis";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";

export interface SearchSchema {
  query: string;
  maxResults?: number;
  resource?: "messages" | "threads";
}

export class GmailSearch extends GmailBaseTool {
  name = "search_gmail";

  description =
    "Use this tool to search for email messages or threads. The input must be a valid Gmail query. The output is a JSON list of the requested resource.";

  constructor(fields: GmailBaseToolParams) {
    super(fields);
  }

  async _call(args: SearchSchema) {
    const auth = await this.getAuth();
    const gmail = google.gmail({ version: "v1", auth });
    const { query, maxResults = 10, resource = "messages" } = args;

    const response = await gmail.users.messages.list({
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
    const auth = await this.getAuth();
    const gmail = google.gmail({ version: "v1", auth });
    const parsedMessages = await Promise.all(
      messages.map(async (message) => {
        const messageData = await gmail.users.messages.get({
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
    const auth = await this.getAuth();
    const gmail = google.gmail({ version: "v1", auth });
    const parsedThreads = await Promise.all(
      threads.map(async (thread) => {
        const threadData = await gmail.users.threads.get({
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

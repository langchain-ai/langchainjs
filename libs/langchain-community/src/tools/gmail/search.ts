import { gmail_v1 } from "googleapis";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
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

  async _call(arg: InferInteropZodOutput<typeof this.schema>) {
    const { query, maxResults = 10, resource = "messages" } = arg;

    try {
      const gmail = await this.getGmailClient();

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
        const parsedMessages = await this.parseMessages(gmail, messages);
        return `Result for the query ${query}:\n${JSON.stringify(
          parsedMessages
        )}`;
      } else if (resource === "threads") {
        const parsedThreads = await this.parseThreads(gmail, messages);
        return `Result for the query ${query}:\n${JSON.stringify(
          parsedThreads
        )}`;
      }

      throw new Error(`Invalid resource: ${resource}`);
    } catch (error) {
      throw new Error(`Error while searching Gmail: ${error}`);
    }
  }

  async parseMessages(
    gmail: gmail_v1.Gmail,
    messages: gmail_v1.Schema$Message[]
  ): Promise<gmail_v1.Schema$Message[]> {
    const parsedMessages = await Promise.all(
      messages.map(async (message) => {
        try {
          const { data } = await gmail.users.messages.get({
            userId: "me",
            format: "full",
            id: message.id ?? "",
          });

          const { payload } = data;

          const { subject, sender, body } = this.parseHeaderAndBody(payload);

          return {
            id: message.id,
            threadId: message.threadId,
            snippet: data.snippet,
            body,
            subject,
            sender,
          };
        } catch (error) {
          throw new Error(`Error while fetching message: ${error}`);
        }
      })
    );
    return parsedMessages;
  }

  async parseThreads(
    gmail: gmail_v1.Gmail,
    messages: gmail_v1.Schema$Message[]
  ): Promise<gmail_v1.Schema$Thread[]> {
    const parsedThreads = await Promise.all(
      messages.map(async (message) => {
        try {
          const {
            data: { messages },
          } = await gmail.users.threads.get({
            userId: "me",
            format: "full",
            id: message.threadId ?? "",
          });

          const { subject, sender, body } = this.parseHeaderAndBody(
            messages?.[0]?.payload
          );

          return {
            id: message.threadId,
            snippet: messages?.[0]?.snippet,
            body,
            subject,
            sender,
          };
        } catch (error) {
          throw new Error(`Error while fetching thread: ${error}`);
        }
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

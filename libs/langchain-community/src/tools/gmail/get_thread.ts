import { z } from "zod";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";
import { GET_THREAD_DESCRIPTION } from "./descriptions.js";

export class GmailGetThread extends GmailBaseTool {
  name = "gmail_get_thread";

  schema = z.object({
    threadId: z.string(),
  });

  description = GET_THREAD_DESCRIPTION;

  constructor(fields?: GmailBaseToolParams) {
    super(fields);
  }

  async _call(arg: z.output<typeof this.schema>) {
    const { threadId } = arg;

    const thread = await this.gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });

    const { data } = thread;

    if (!data) {
      throw new Error("No data returned from Gmail");
    }

    const { messages } = data;

    if (!messages) {
      throw new Error("No messages returned from Gmail");
    }

    return `Result for the prompt ${threadId} \n${JSON.stringify(
      messages.map((message) => {
        const { payload } = message;

        if (!payload) {
          throw new Error("No payload returned from Gmail");
        }

        const { headers } = payload;

        if (!headers) {
          throw new Error("No headers returned from Gmail");
        }

        const subject = headers.find((header) => header.name === "Subject");

        if (!subject) {
          throw new Error("No subject returned from Gmail");
        }

        const body = headers.find((header) => header.name === "Body");

        if (!body) {
          throw new Error("No body returned from Gmail");
        }

        const from = headers.find((header) => header.name === "From");

        if (!from) {
          throw new Error("No from returned from Gmail");
        }

        const to = headers.find((header) => header.name === "To");

        if (!to) {
          throw new Error("No to returned from Gmail");
        }

        const date = headers.find((header) => header.name === "Date");

        if (!date) {
          throw new Error("No date returned from Gmail");
        }

        const messageIdHeader = headers.find(
          (header) => header.name === "Message-ID"
        );

        if (!messageIdHeader) {
          throw new Error("No message id returned from Gmail");
        }

        return {
          subject: subject.value,
          body: body.value,
          from: from.value,
          to: to.value,
          date: date.value,
          messageId: messageIdHeader.value,
        };
      })
    )}`;
  }
}

export type GetThreadSchema = {
  threadId: string;
};

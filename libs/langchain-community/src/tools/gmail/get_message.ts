import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { GmailBaseToolParams, GmailBaseTool } from "./base.js";
import { GET_MESSAGE_DESCRIPTION } from "./descriptions.js";

export class GmailGetMessage extends GmailBaseTool {
  name = "gmail_get_message";

  schema = z.object({
    messageId: z.string(),
  });

  description = GET_MESSAGE_DESCRIPTION;

  constructor(fields?: GmailBaseToolParams) {
    super(fields);
  }

  async _call(arg: InferInteropZodOutput<typeof this.schema>) {
    const { messageId } = arg;

    const gmail = await this.getGmailClient();

    const { data } = await gmail.users.messages.get({
      userId: "me",
      format: "full",

      id: messageId,
    });

    if (!data) {
      throw new Error("No data returned from Gmail");
    }

    const { payload } = data;

    if (!payload) {
      throw new Error("No payload returned from Gmail");
    }

    const { headers } = payload;

    if (!headers) {
      throw new Error("No headers returned from Gmail");
    }

    const { subject, sender, body } = this.parseHeaderAndBody(payload);

    if (!subject) {
      throw new Error("No subject returned from Gmail");
    }

    if (!body) {
      throw new Error("No body returned from Gmail");
    }

    if (!sender) {
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

    return `Result for the prompt ${messageId} \n${JSON.stringify({
      subject: subject.value,
      body,
      from: sender.value,
      to: to.value,
      date: date.value,
      messageId: messageIdHeader.value,
    })}`;
  }
}

export type GetMessageSchema = {
  messageId: string;
};

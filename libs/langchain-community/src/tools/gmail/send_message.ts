import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";
import { GET_MESSAGE_DESCRIPTION } from "./descriptions.js";

const sendMessageSchema = z.object({
  message: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
});
export type SendMessageSchema = z.infer<typeof sendMessageSchema>;

export class GmailSendMessage extends GmailBaseTool {
  name = "gmail_send_message";

  schema = sendMessageSchema;

  description = GET_MESSAGE_DESCRIPTION;

  constructor(fields?: GmailBaseToolParams) {
    super(fields);
  }

  private createEmailMessage({
    message,
    to,
    subject,
    cc,
    bcc,
  }: SendMessageSchema): string {
    const emailLines: string[] = [];

    // Format the recipient(s)
    const formatEmailList = (emails: string | string[]): string =>
      Array.isArray(emails) ? emails.join(",") : emails;

    emailLines.push(`To: ${formatEmailList(to)}`);
    if (cc) emailLines.push(`Cc: ${formatEmailList(cc)}`);
    if (bcc) emailLines.push(`Bcc: ${formatEmailList(bcc)}`);
    emailLines.push(`Subject: ${subject}`);
    emailLines.push("");
    emailLines.push(message);

    // Convert the email message to base64url string
    const email = emailLines.join("\r\n").trim();
    // this encode may be an issue
    return Buffer.from(email).toString("base64url");
  }

  async _call({
    message,
    to,
    subject,
    cc,
    bcc,
  }: InferInteropZodOutput<SendMessageSchema>): Promise<string> {
    const rawMessage = this.createEmailMessage({
      message,
      to,
      subject,
      cc,
      bcc,
    });

    try {
      const gmail = await this.getGmailClient();

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawMessage,
        },
      });

      return `Message sent. Message Id: ${response.data.id}`;
    } catch (error) {
      throw new Error(`An error occurred while sending the message: ${error}`);
    }
  }
}

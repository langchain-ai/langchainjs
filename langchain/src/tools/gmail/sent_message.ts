import { google } from "googleapis";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";

interface SendMessageParams {
  message: string;
  to: string | string[];
  subject: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export class GmailSendMessage extends GmailBaseTool {
  name = "gmail_send_message";

  description = "Send a message using Gmail";

  constructor(fields: GmailBaseToolParams) {
    super(fields);
  }

  private createEmailMessage({
    message,
    to,
    subject,
    cc,
    bcc,
  }: SendMessageParams): string {
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

  protected async _call({
    message,
    to,
    subject,
    cc,
    bcc,
  }: SendMessageParams): Promise<string> {
    return this.sendMessage({ message, to, subject, cc, bcc });
  }

  async sendMessage({
    message,
    to,
    subject,
    cc,
    bcc,
  }: SendMessageParams): Promise<string> {
    const auth = await this.getAuth();
    const gmail = google.gmail({ version: "v1", auth });

    const rawMessage = this.createEmailMessage({
      message,
      to,
      subject,
      cc,
      bcc,
    });

    try {
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

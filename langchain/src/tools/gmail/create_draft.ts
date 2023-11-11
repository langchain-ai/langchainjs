import { google } from "googleapis";
import { encodeToBase64 } from "@gomomento/sdk-core/dist/src/internal/utils/string.js";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";

export interface CreateDraftSchema {
  message: string;
  to: string[];
  subject: string;
  cc?: string[];
  bcc?: string[];
}

export class GmailCreateDraft extends GmailBaseTool {
  name = "create_gmail_draft";

  description =
    "Use this tool to create a draft email with the provided message fields.";

  constructor(fields: GmailBaseToolParams) {
    super(fields);
  }

  private prepareDraftMessage(
    message: string,
    to: string[],
    subject: string,
    cc?: string[],
    bcc?: string[]
  ) {
    const draftMessage = {
      message: {
        raw: "",
      },
    };

    const email = [
      `To: ${to.join(", ")}`,
      `Subject: ${subject}`,
      cc ? `Cc: ${cc.join(", ")}` : "",
      bcc ? `Bcc: ${bcc.join(", ")}` : "",
      "",
      message,
    ].join("\n");

    draftMessage.message.raw = encodeToBase64(email);

    return draftMessage;
  }

  async _call(args: CreateDraftSchema) {
    const auth = await this.getAuth();

    const gmail = google.gmail({ version: "v1", auth });
    const { message, to, subject, cc, bcc } = args;
    const create_message = this.prepareDraftMessage(
      message,
      to,
      subject,
      cc,
      bcc
    );

    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: create_message,
    });

    return `Draft created. Draft Id: ${response.data.id}`;
  }
}

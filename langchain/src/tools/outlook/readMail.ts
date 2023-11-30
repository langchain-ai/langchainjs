import { OutlookBase } from "./base.js";
import { READ_MAIL_TOOL_DESCRIPTION } from "./descriptions.js";
import { AuthFlowBase } from './authFlowBase.js';

interface Email {
  subject: string;
  body: { content: string; };
  sender: { emailAddress: { name: string; address: string; } };
}
export class OutlookReadMailTool extends OutlookBase {
  name = "outlook_read_mail";

  description = READ_MAIL_TOOL_DESCRIPTION;

  constructor(authFlow: AuthFlowBase) {
    super(authFlow);
  }

  async _call(query: string) {
    console.log("query: ", query);
    try {
        await this.getAuth();
    } catch (error) {
      return `Failed to get access token: ${error}`;
    }
    // fetch emails from me/messages
    const response = await fetch("https://graph.microsoft.com/v1.0/me/messages?$select=sender,subject,body", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      return `Fetch mail error: ${response.status}`;
    }
    try {
      // parse response
      const data = await response.json() as { value: Email[] };
      const formattedEmails = data.value.map(email => {
      const subject = email?.subject ?? 'No subject';
      const bodyContent = email?.body?.content ?? 'No content';
      const senderName = email?.sender?.emailAddress?.name ?? 'Unknown Sender';
      const senderAddress = email?.sender?.emailAddress?.address ?? 'No address';
      // Constructing the email string
      return `subject: ${subject}\nsender: ${senderName} ${senderAddress}\nbody: ${bodyContent}\n`;
      }).join("\n");

      return formattedEmails;
    } catch (error) {
        return `Failed to parse response: ${error}`;
    }
    
  }
}
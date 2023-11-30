import { OutlookBase, OutlookCredentials } from "./base.js";
import { READ_MAIL_TOOL_DESCRIPTION } from "./descriptions.js";

interface Email {
  subject: string;
  body: { content: string; };
  sender: { emailAddress: { name: string; address: string; } };
}

export class OutlookReadMailTool extends OutlookBase {
  name = "outlook_read_mail";

  description = READ_MAIL_TOOL_DESCRIPTION;

  constructor(fields: OutlookCredentials) {
    super(fields);
  }

  async _call(query: string) {
    console.log("query: ", query);
    const accessToken = await this.getAuth();
    try {
        const response = await fetch("https://graph.microsoft.com/v1.0/me/messages?$select=sender,subject,body", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
    
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json() as { value: Email[] };
        const formattedEmails = data.value.map(email => {
          const { subject, body, sender } = email;
          const senderInfo = `${sender.emailAddress.name} ${sender.emailAddress.address}`;
          return `subject: ${subject}\nsender: ${senderInfo}\nbody: ${body.content}\n`;
        }).join("\n");
  
        return formattedEmails;
    } catch (error) {
        return `Failed to read email: ${error}`;
    }
    
  }
}
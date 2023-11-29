import { OutlookBase, OutlookCredentials } from "./base.js";
import { SEND_MAIL_TOOL_DESCRIPTION } from "./descriptions.js";

export class OutlookSendMailTool extends OutlookBase {
  name = "outlook_send_mail";

  description = SEND_MAIL_TOOL_DESCRIPTION;

  constructor(fields: OutlookCredentials) {
    super(fields);
  }

  async _call(message: string) {
    const accessToken = await this.getAuth();
    let newMessage;
    try {
        const { subject, content, to, cc } = JSON.parse(message);

        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

        if (!Array.isArray(to) || !to.every((item: string) => emailRegex.test(item))) {
          return 'To must be an array of strings';
        }
    
        if (cc && (!Array.isArray(cc) || !cc.every((item: string) => emailRegex.test(item)))) {
          return 'CC must be an array of strings';
        }

        newMessage = {
            message: {
                subject: String(subject),
                body: {
                  contentType: "Text",
                  content: String(content),
                },
                toRecipients: to.map((address: string) => ({
                  emailAddress: {
                    address,
                  },
                })),
                ...(cc && {
                  ccRecipients: cc.map((address: string) => ({
                    emailAddress: {
                      address,
                    },
                  })),
                }),
              },
              saveToSentItems: "true",
        };
    } catch (e) {
        return 'Invalid JSON format';
    }
    try {
        const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newMessage),
        });
    
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
    
        return 'Email sent';
    } catch (error) {
        return `Failed to send email: ${error}`;
    }
    
  }
}
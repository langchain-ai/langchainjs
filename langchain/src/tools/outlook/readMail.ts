import { OutlookBase, OutlookCredentials } from "./base.js";
import { READ_MAIL_TOOL_DESCRIPTION } from "./descriptions.js";

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
        const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
    
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        
        const data = await response.json();
        const emails = data.value.map((email: any) => { JSON.stringify(email); });
        return emails;
    } catch (error) {
        return `Failed to send email: ${error}`;
    }
    
  }
}
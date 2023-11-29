// import { Tool, type ToolParams } from "../base.js";


export interface Email {
  sender: string;
  subject: string;
  // Add other properties as needed
}

// interface SendEmailParams {
//   to: string;
//   subject: string;
//   content: string;
// }

// interface ReadEmailParams {
//   // Define parameters for reading emails if needed
// }

// ... other parameter types for different actions
interface GetMailTipsParams {
  emailAddresses: string[];  // Array of email addresses to get mail tips for
  mailTipTypes: string[];    // Types of mail tips you want to retrieve (e.g., "automaticReplies", "mailboxFullStatus")
}


/**
 * The OutlookIntegration class is a tool used to send and 
 * read emails. It extends the base Tool class.
 */
export class OutlookIntegration {
  private accessToken: string; // Store the OAuth2 access token

  static lc_name() {
    return "Outlook Integration";
  }
  name = "outlook-integration";
  description = `Useful for sending and reading emails. The input to this tool should be a valid email address.`;

  // constructor(params: ToolParams) {
    // super(params);
  constructor(access_token: string) {
    this.accessToken = access_token;
  }


  async readme(): Promise<string> {
    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to read me:", error);
      throw error;
    }
  }

  async readEmails(): Promise<Email[]> {
    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders('Inbox')/messages?$select=sender,subject", {
        headers: {
          // Authorization: `Bearer ${this.accessToken}`,
          Authorization: `${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      return data.value; // Assuming 'value' contains the array of emails
    } catch (error) {
      console.error("Failed to read emails:", error);
      throw error;
    }
  }

  // async sendEmail(to: string, subject: string, content: string): Promise<void> {
  async sendEmail(): Promise<void> {
    const message = {
      message: {
        subject: "subject",
        body: {
          contentType: "Text",
          content: "content",
        },
        toRecipients: [
          {
            emailAddress: {
              address: "oscar17chen@gmail.com",
            },
          },
        ],
      },
    };

    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      console.log("Email sent successfully");
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }

  async getMailTips(params: GetMailTipsParams): Promise<any> {
    const payload = {
      EmailAddresses: params.emailAddresses,
      MailTipsOptions: params.mailTipTypes.join(','),
    };
  
    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/getMailTips", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
  
      const data = await response.json();
      return data.value; // Assuming 'value' contains the mail tips
    } catch (error) {
      console.error("Failed to get mail tips:", error);
      throw error;
    }
  }
  
  // Combined _call method with all cases
  // async _call(action: string, params: SendEmailParams | ReadEmailParams | GetMailTipsParams): Promise<void> {
  //   switch (action) {
  //     case "sendEmail":
  //       const { to, subject, content } = params as SendEmailParams;
  //       await this.sendEmail(to, subject, content);
  //       break;
  //     case "readEmails":
  //       await this.readEmails();
  //       break;
  //     case "getMailTips":
  //       await this.getMailTips(params as GetMailTipsParams);
  //       break;
  //     default:
  //       throw new Error(`Action ${action} is not supported`);
  //   }
  // }
}

  

  // You can add more methods for other features like managing contacts, calendar, etc.




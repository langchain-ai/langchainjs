import { OutlookBase } from "./base.js";
import { READ_MAIL_TOOL_DESCRIPTION } from "./descriptions.js";
import { AuthFlowBase } from "./auth/base.js";

/**
 * Represents an email retrieved from Outlook.
 * @interface
 */
interface Email {
  subject: string;
  body: { content: string };
  sender: { emailAddress: { name: string; address: string } };
}

/**
 * Class for interacting with the Outlook API to read emails.
 * @extends OutlookBase
 */
export class OutlookReadMailTool extends OutlookBase {
  /** The name of the Outlook Read Mail tool. */
  name = "outlook_read_mail";

  /** The description of the Outlook Read Mail tool. */
  description = READ_MAIL_TOOL_DESCRIPTION;

  /**
   * Constructor for the OutlookReadMailTool class.
   * @param {AuthFlowBase} [authFlow] - The authentication flow for the tool.
   * @param {string} [choice] - Additional choice parameter.
   */
  constructor(authFlow?: AuthFlowBase, choice?: string) {
    super(authFlow, choice);
  }

  /**
   * Calls the Outlook API to fetch emails based on the provided query.
   * @param {string} query - The query string to filter emails.
   * @returns {Promise<string>} - A formatted string containing email details.
   */
  async _call(query: string): Promise<string> {
    try {
      // Ensure authentication is completed before making the API call.
      this.accessToken = await this.authFlow.getAccessToken();
    } catch (error) {
      // Handle authentication error.
      return `Failed to get access token: ${error}`;
    }

    // Validate the format of the query string.
    const queryRegex =
      /^\$search="(?:body|cc|from|received|recipients|sent|subject|to)(?::[^"]*)?"$/;
    if (query && !queryRegex.test(query)) {
      return "Invalid query format";
    }

    // Fetch emails from the Outlook API.
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?${query}&$top=5`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      // Handle API call error.
      return `Fetch mail error: ${response.status}`;
    }

    try {
      // Parse the API response and format email details.
      const data = (await response.json()) as { value: Email[] };
      const formattedEmails = data.value
        .map((email) => {
          const subject = email?.subject ?? "No subject";
          const bodyContent = email?.body?.content ?? "No content";
          const senderName =
            email?.sender?.emailAddress?.name ?? "Unknown Sender";
          const senderAddress =
            email?.sender?.emailAddress?.address ?? "No address";

          // Constructing the email string.
          return `subject: ${subject}\nsender: ${senderName} ${senderAddress}\nbody: ${bodyContent}\n`;
        })
        .join("\n");

      return formattedEmails;
    } catch (error) {
      // Handle response parsing error.
      return `Failed to parse response: ${error}`;
    }
  }
}

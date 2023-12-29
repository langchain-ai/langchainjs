import { OutlookBase } from "./base.js";
import { SEND_MAIL_TOOL_DESCRIPTION } from "./descriptions.js";
import { AuthFlowBase } from "./auth/base.js";

/**
 * Class representing an Outlook send mail tool.
 * @extends OutlookBase
 */
export class OutlookSendMailTool extends OutlookBase {
  /**
   * The name of the send mail tool.
   * @type {string}
   */
  name = "outlook_send_mail";

  /**
   * The description of the send mail tool.
   * @type {string}
   */
  description = SEND_MAIL_TOOL_DESCRIPTION;

  /**
   * Creates an instance of OutlookSendMailTool.
   * @param {AuthFlowBase} [authFlow] - The authentication flow instance.
   * @param {string} [choice] - The choice string.
   */
  constructor(authFlow?: AuthFlowBase, choice?: string) {
    super(authFlow, choice);
  }

  /**
   * Sends an email using the Outlook API.
   * @param {string} message - The JSON string representing the email message.
   * @returns {Promise<string>} A promise that resolves with the result of the email sending process.
   */
  async _call(message: string): Promise<string> {
    try {
      this.accessToken = await this.authFlow.getAccessToken();
    } catch (error) {
      return `Failed to get access token: ${error}`;
    }

    let newMessage: string;
    try {
      // parse message
      const { subject, content, to, cc } = JSON.parse(message);
      // validate message
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

      if (
        !Array.isArray(to) ||
        !to.every((item: string) => emailRegex.test(item))
      ) {
        return "TO must be an array of valid email in strings";
      }

      if (
        cc &&
        (!Array.isArray(cc) ||
          !cc.every((item: string) => emailRegex.test(item)))
      ) {
        return "CC must be an array of valid email in strings";
      }
      // create new message
      newMessage = JSON.stringify({
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
      });
    } catch (e) {
      return "Invalid JSON format";
    }

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: newMessage,
      }
    );

    if (!response.ok) {
      return `Send mail error: ${response.status}`;
    }

    return "Email sent";
  }
}

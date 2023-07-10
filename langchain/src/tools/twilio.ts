import type Client from "twilio";
import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";

interface ITwilioAPIWrapper {
  client?: Client;
  account_sid?: string;
  auth_token?: string;
  from_number?: string;
}

function getFromConfigOrEnv<TValues extends ITwilioAPIWrapper>(
  values: TValues,
  key: keyof TValues,
  envKey: string
) {
  return values[key] || getEnvironmentVariable(envKey);
}

/**
 * Sms Client using Twilio.
 *
 * To use, you should have the `twilio` package installed, and the environment
 * variables `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
 * `TWILIO_FROM_NUMBER`, or pass `account_sid`, `auth_token`, and `from_number`
 * as named parameters to the constructor.
 *
 * Example:
 * ```
 * import { TwilioAPIWrapper } from 'langchain/tools/twilio';
 *
 * const twilio = new TwilioAPIWrapper({
 *  account_sid: "ACxxx",
 * auth_token: "xxx",
 * from_number: "+10123456789"
 * });
 *
 * twilio.run('test', '+12484345508');
 * ```
 */
export class TwilioAPIWrapper implements ITwilioAPIWrapper {
  client?: Client;
  account_sid?: string;
  auth_token?: string;
  from_number?: string;

  constructor(config?: ITwilioAPIWrapper) {
    if (config) {
      this.account_sid = getFromConfigOrEnv(
        config,
        "account_sid",
        "TWILIO_ACCOUNT_SID"
      );
      this.auth_token = getFromConfigOrEnv(
        config,
        "auth_token",
        "TWILIO_AUTH_TOKEN"
      );
      this.from_number = getFromConfigOrEnv(
        config,
        "from_number",
        "TWILIO_FROM_NUMBER"
      );

      if (this.account_sid && this.auth_token) {
        this._setupClient(this.account_sid, this.auth_token);
      } else {
        throw new Error("Invalid twilio configuration.");
      }
    } else {
      throw new Error("Configuration is required.");
    }
  }

  async _setupClient(account_sid: string, auth_token: string) {
    const { Client } = await TwilioImports();
    this.client = new Client(account_sid, auth_token);
  }

  /**
   * Run body through Twilio and respond with message sid.
   * 
   * @param body The text of the message you want to send. Can be up to 1,600
   *             characters in length.
   * @param to The destination phone number in 
   *           [E.164](https://www.twilio.com/docs/glossary/what-e164) format
   *            for SMS/MMS or
                [Channel user address](https://www.twilio.com/docs/sms/channels#channel-addresses)
                for other 3rd-party channels. 
   * @returns The message SID
   */
  async run(body: string, to: string): Promise<string> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      const message = await this.client.messages.create({
        body: body,
        from: this.from_number,
        to: to,
      });
      return message.sid;
    } catch (error) {
      throw error;
    }
  }
}

async function TwilioImports() {
  try {
    const Client = await import("twilio");

    return {
      Client: Client as typeof Client,
    };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load twilio'. Please install it eg. `yarn add twilio`."
    );
  }
}

export class TwilioTool extends Tool {
  name = "Text Message";
  description = `Useful for when you need to send a text message to a provided phone number.`;

  client: TwilioAPIWrapper;

  constructor(config?: ITwilioAPIWrapper) {
    super();
    this.client = new TwilioAPIWrapper(config);
  }

  /** @ignore */
  async _call(input: string) {
    try {
      // TODO: Set phone number from input or config
      return this.client.run(input, "+12484345508");
    } catch (error) {
      return "I don't know how to do that.";
    }
  }
}

import { gmail_v1, google } from "googleapis";
import { z } from "zod";
import { Tool } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
    keyfile?: string;
  };
  scopes?: string[];
}

const CredentialsSchema = z
  .object({
    clientEmail: z
      .string()
      .default(getEnvironmentVariable("GMAIL_CLIENT_EMAIL") ?? ""),
    privateKey: z
      .string()
      .default(getEnvironmentVariable("GMAIL_PRIVATE_KEY") ?? ""),
    keyfile: z.string().default(getEnvironmentVariable("GMAIL_KEYFILE") ?? ""),
  })
  .refine((data) => data.clientEmail !== "", {
    message: "Missing GMAIL_CLIENT_EMAIL to interact with Gmail",
  })
  .refine((data) => data.privateKey !== "" || data.keyfile !== "", {
    message:
      "Missing GMAIL_PRIVATE_KEY or GMAIL_KEYFILE to interact with Gmail",
  });

const GmailBaseToolParamsSchema = z.object({
  credentials: CredentialsSchema.default({}),
  scopes: z.array(z.string()).default(["https://mail.google.com/"]),
});

export abstract class GmailBaseTool extends Tool {
  name = "Gmail";

  description = "A tool to send and view emails through Gmail";

  protected gmail: gmail_v1.Gmail;

  constructor(fields?: Partial<GmailBaseToolParams>) {
    super(...arguments);

    const { credentials, scopes } = GmailBaseToolParamsSchema.parse(
      fields ?? {}
    );

    this.gmail = this.getGmail(
      scopes,
      credentials.clientEmail,
      credentials.privateKey,
      credentials.keyfile
    );
  }

  private getGmail(
    scopes: string[],
    email: string,
    key?: string,
    keyfile?: string
  ) {
    const auth = new google.auth.JWT(email, keyfile, key, scopes);

    return google.gmail({ version: "v1", auth });
  }
}

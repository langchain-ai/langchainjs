import { gmail_v1, google } from "googleapis";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
    keyfile?: string;
  };
  scopes?: string[];
}

export abstract class GmailBaseTool extends StructuredTool {
  private CredentialsSchema = z
    .object({
      clientEmail: z
        .string()
        .min(1)
        .default(getEnvironmentVariable("GMAIL_CLIENT_EMAIL") ?? ""),
      privateKey: z
        .string()
        .default(getEnvironmentVariable("GMAIL_PRIVATE_KEY") ?? ""),
      keyfile: z
        .string()
        .default(getEnvironmentVariable("GMAIL_KEYFILE") ?? ""),
    })
    .refine(
      (credentials) =>
        credentials.privateKey !== "" || credentials.keyfile !== "",
      {
        message:
          "Missing GMAIL_PRIVATE_KEY or GMAIL_KEYFILE to interact with Gmail",
      }
    );

  private GmailBaseToolParamsSchema = z
    .object({
      credentials: this.CredentialsSchema.default({}),
      scopes: z.array(z.string()).default(["https://mail.google.com/"]),
    })
    .default({});

  name = "Gmail";

  description = "A tool to send and view emails through Gmail";

  protected gmail: gmail_v1.Gmail;

  constructor(fields?: Partial<GmailBaseToolParams>) {
    super(...arguments);

    const { credentials, scopes } =
      this.GmailBaseToolParamsSchema.parse(fields);

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

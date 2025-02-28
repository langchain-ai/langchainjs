import { gmail_v1, google } from "googleapis";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
    keyfile?: string;
    subject?: string;
    accessToken?: string;
  };
  scopes?: string[];
}

export abstract class GmailBaseTool extends StructuredTool {
  private CredentialsSchema = z
    .object({
      clientEmail: z
        .string()
        .default(getEnvironmentVariable("GMAIL_CLIENT_EMAIL") ?? ""),
      privateKey: z
        .string()
        .default(getEnvironmentVariable("GMAIL_PRIVATE_KEY") ?? ""),
      keyfile: z
        .string()
        .default(getEnvironmentVariable("GMAIL_KEYFILE") ?? ""),
      subject: z
        .string()
        .default(getEnvironmentVariable("GMAIL_SUBJECT") ?? ""),
      accessToken: z.string().default(""),
    })
    .refine(
      (credentials) =>
        credentials.accessToken !== "" || credentials.clientEmail !== "",
      {
        message: "Missing GMAIL_CLIENT_EMAIL to interact with Gmail",
      }
    )
    .refine(
      (credentials) =>
        credentials.privateKey !== "" ||
        credentials.keyfile !== "" ||
        credentials.accessToken !== "",
      {
        message:
          "Missing GMAIL_PRIVATE_KEY or GMAIL_KEYFILE or accessToken to interact with Gmail",
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
      credentials.keyfile,
      credentials.subject,
      credentials.accessToken
    );
  }

  private getGmail(
    scopes: string[],
    email: string,
    key?: string,
    keyfile?: string,
    subject?: string,
    accessToken?: string
  ) {
    if (accessToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      return google.gmail({ version: "v1", auth });
    }

    const auth = new google.auth.JWT(email, keyfile, key, scopes, subject);

    return google.gmail({ version: "v1", auth });
  }

  parseHeaderAndBody(payload: gmail_v1.Schema$MessagePart | undefined) {
    if (!payload) {
      return { body: "" };
    }

    const headers = payload.headers || [];

    const subject = headers.find((header) => header.name === "Subject");
    const sender = headers.find((header) => header.name === "From");

    let body = "";
    if (payload.parts) {
      body = payload.parts
        .map((part) =>
          part.mimeType === "text/plain"
            ? this.decodeBody(part.body?.data ?? "")
            : ""
        )
        .join("");
    } else if (payload.body?.data) {
      body = this.decodeBody(payload.body.data);
    }

    return { subject, sender, body };
  }

  decodeBody(body: string) {
    if (body) {
      try {
        // Gmail uses URL-safe base64 encoding, so we need to handle it properly
        // Replace URL-safe characters and decode
        return atob(body.replace(/-/g, "+").replace(/_/g, "/"));
      } catch (error) {
        // Keep the original encoded body if decoding fails
        return body;
      }
    }
    return "";
  }
}

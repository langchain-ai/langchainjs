import { Client, Hbar } from "@hashgraph/sdk";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface HederaBaseToolParams {
  credentials?: {
    accountId?: string;
    privateKey?: string;
  };
  network?: string;
  maxTransactionFee?: number;
  maxQueryPayment?: number;
}

export abstract class HederaBaseTool extends StructuredTool {
  private CredentialsSchema = z
    .object({
      accountId: z
        .string()
        .min(1)
        .default(getEnvironmentVariable("HEDERA_ACCOUNT_ID") ?? ""),
      privateKey: z
        .string()
        .min(1)
        .default(getEnvironmentVariable("HEDERA_PRIVATE_KEY") ?? ""),
    })
    .refine(
      (credentials: { accountId: string; privateKey: string }) =>
        credentials.accountId !== "" || credentials.privateKey !== "",
      {
        message:
          "Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY to interact with Hedera",
      }
    );

  private HederaBaseToolParamsSchema = z.object({
    credentials: this.CredentialsSchema.default({}),
    network: z.enum(["mainnet", "testnet", "previewnet"]).default("testnet"),
    maxTransactionFee: z.number().default(100),
    maxQueryPayment: z.number().default(50),
  });

  name = "Hedera Tool";

  description = "A tool for interacting with the Hedera network.";

  protected client: Client;

  constructor(fields?: Partial<HederaBaseToolParams>) {
    super(...arguments);

    const { credentials, network, maxTransactionFee, maxQueryPayment } =
      this.HederaBaseToolParamsSchema.parse(fields);

    this.client = this.getHederaClient(
      network,
      credentials.accountId,
      credentials.privateKey,
      maxTransactionFee,
      maxQueryPayment
    );
  }

  private getHederaClient(
    network: "mainnet" | "testnet" | "previewnet",
    accountId: string,
    privateKey: string,
    maxTransactionFee: number,
    maxQueryPayment: number
  ): Client {
    let client: Client;
    if (network === "mainnet") {
      client = Client.forMainnet();
    } else if (network === "testnet") {
      client = Client.forTestnet();
    } else {
      client = Client.forPreviewnet();
    }
    client.setOperator(accountId, privateKey);
    client.setDefaultMaxTransactionFee(new Hbar(maxTransactionFee));
    client.setDefaultMaxQueryPayment(new Hbar(maxQueryPayment));
    return client;
  }
}

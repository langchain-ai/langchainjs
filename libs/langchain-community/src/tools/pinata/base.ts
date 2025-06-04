import { PinataSDK } from "pinata";
import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for parameters required by all Pinata tools.
 * @property {string} [pinataJwt] - JWT token for authenticating with Pinata API.
 * @property {string} [pinataGateway] - Custom IPFS gateway URL.
 * @property {PinataSDK} [pinataClient] - Pre-initialized Pinata SDK client (Alternative).
 */
export interface PinataToolParams {
  pinataJwt?: string;
  pinataGateway?: string;
  pinataClient?: PinataSDK;
}

/**
 * Abstract base class for all Pinata tools.
 * Handles shared constructor logic and initialization of the Pinata SDK client.
 */
export abstract class BasePinataTool extends StructuredTool {
  protected pinata: PinataSDK;
  protected pinataGateway: string;

  /**
   * Constructor for base tool class.
   * @param {PinataToolParams} [fields] - Optional parameters to initialize the tool.
   * @throws {Error} If neither `pinataJwt` nor `pinataClient` is provided.
   * @throws {Error} If `pinataGateway` is not provided when a `pinataClient` is not used.
   */
  constructor(fields?: PinataToolParams) {
    super();

    const {
      pinataJwt = getEnvironmentVariable("PINATA_JWT"),
      pinataGateway,
      pinataClient,
    } = fields ?? {};

    if (!pinataJwt && !pinataClient) {
      throw new Error(
        "Pinata JWT or a pre-initialized PinataClient is required, but neither was provided."
      );
    }

    if (!pinataGateway && !pinataClient) {
      throw new Error(
        "Pinata Gateway must be provided manually if a PinataClient is not provided."
      );
    }

    this.pinataGateway = pinataGateway!;
    this.pinata =
      pinataClient ??
      new PinataSDK({
        pinataJwt: pinataJwt!,
        pinataGateway: this.pinataGateway,
      });
  }
}

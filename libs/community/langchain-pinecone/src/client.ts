import { Pinecone, PineconeConfiguration } from "@pinecone-database/pinecone";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export function getPineconeClient(config?: PineconeConfiguration): Pinecone {
  if (
    getEnvironmentVariable("PINECONE_API_KEY") === undefined ||
    getEnvironmentVariable("PINECONE_API_KEY") === ""
  ) {
    throw new Error("PINECONE_API_KEY must be set in environment");
  }
  if (!config) {
    return new Pinecone();
  } else {
    return new Pinecone(config);
  }
}

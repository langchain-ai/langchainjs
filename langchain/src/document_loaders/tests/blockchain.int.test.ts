import { test } from "@jest/globals";
import { BlockchainPagesLoader } from "../web/blockchain.js";

const SORT_XYZ_DEMO_API_KEY = "dd46a0ae-5a1a-4c6f-8328-46618c4a73d4";
const contractAddress = "0x887F3909C14DAbd9e9510128cA6cBb448E932d7f".toLowerCase();

test("Test Blockchain NFT Metadata Loader", async () => {
  const nftMetadataLoader = new BlockchainPagesLoader({
    apiKey: SORT_XYZ_DEMO_API_KEY,
    query: {
      type: "NFTMetadata",
      blockchain: "ethereum",
      contractAddress
    }
  });

  await nftMetadataLoader.load();
});

test("Test Blockchain Latest Transactions Loader", async () => {
  const latestTransactionsLoader = new BlockchainPagesLoader({
    apiKey: SORT_XYZ_DEMO_API_KEY,
    query: {
      type: "latestTransactions",
      blockchain: "ethereum",
      contractAddress
    }
  });

  await latestTransactionsLoader.load();
});

test("Test Blockchain SQL Query Loader", async () => {
  const sqlQueryLoader = new BlockchainPagesLoader({
    apiKey: SORT_XYZ_DEMO_API_KEY,
    query: `SELECT * FROM ethereum.nft_metadata WHERE contract_address = '${contractAddress}' AND token_id = 1 LIMIT 1`
  });

  await sqlQueryLoader.load();
});


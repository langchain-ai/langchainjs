import { test } from "@jest/globals";
import { BlockchainPagesLoader } from "../web/blockchain.js";

const SORT_XYZ_DEMO_API_KEY = "dd46a0ae-5a1a-4c6f-8328-46618c4a73d4";

test("Test Blockchain NFT Metadata Loader", async () => {
  const nftMetadataLoader = new BlockchainPagesLoader({
    apiKey:SORT_XYZ_DEMO_API_KEY,
    queryType:"NFTMetadata",
    contractAddress:"0x887F3909C14DAbd9e9510128cA6cBb448E932d7f"
  });

  await nftMetadataLoader.load();  
});

test("Test Blockchain Latest Transactions Loader", async () => {
  const latestTransactionsLoader = new BlockchainPagesLoader({
    apiKey:SORT_XYZ_DEMO_API_KEY,
    contractAddress:"0x887F3909C14DAbd9e9510128cA6cBb448E932d7f",
    queryType:"latestTransactions"
  });

  await latestTransactionsLoader.load();
});

test("Test Blockchain SQL Query Loader", async () => {
  const sqlQueryLoader = new BlockchainPagesLoader({
    apiKey:SORT_XYZ_DEMO_API_KEY,
    queryType:"sql",
    // Query NFT Metadata for indes/id 1, and contract address 0x887F3909C14DAbd9e9510128cA6cBb448E932d7f
    sql:"SELECT * FROM ethereum.nft_metadata WHERE contract_address = '" + "0x887F3909C14DAbd9e9510128cA6cBb448E932d7f".toLowerCase() + "' and token_id = 1 limit 1"
  });

  await sqlQueryLoader.load();
});


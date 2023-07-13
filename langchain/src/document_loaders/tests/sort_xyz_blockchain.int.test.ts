import { test } from "@jest/globals";
import { SortXYZBlockchainLoader } from "../web/sort_xyz_blockchain.js";

const SORT_XYZ_DEMO_API_KEY = "dd46a0ae-5a1a-4c6f-8328-46618c4a73d4";
const contractAddress =
  "0x887F3909C14DAbd9e9510128cA6cBb448E932d7f".toLowerCase();

test.skip("Test Blockchain NFT Metadata Loader", async () => {
  const nftMetadataLoader = new SortXYZBlockchainLoader({
    apiKey: SORT_XYZ_DEMO_API_KEY,
    query: {
      type: "NFTMetadata",
      blockchain: "ethereum",
      contractAddress,
      limit: 3,
    },
  });

  const response = await nftMetadataLoader.load();
  console.log(response);
});

test.skip("Test Blockchain Latest Transactions Loader", async () => {
  const latestTransactionsLoader = new SortXYZBlockchainLoader({
    apiKey: SORT_XYZ_DEMO_API_KEY,
    query: {
      type: "latestTransactions",
      blockchain: "ethereum",
      contractAddress,
      limit: 3,
    },
  });

  const response = await latestTransactionsLoader.load();
  console.log(response);
});

test.skip("Test Blockchain SQL Query Loader", async () => {
  const sqlQueryLoader = new SortXYZBlockchainLoader({
    apiKey: SORT_XYZ_DEMO_API_KEY,
    query: `SELECT * FROM ethereum.nft_metadata WHERE contract_address = '${contractAddress}' AND token_id = 1 LIMIT 1`,
  });

  const response = await sqlQueryLoader.load();
  console.log(response);
});

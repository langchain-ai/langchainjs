import { SortXYZBlockchainLoader } from "langchain/document_loaders/web/sort_xyz_blockchain";
import { OpenAI } from "@langchain/openai";

/**
 * See https://docs.sort.xyz/docs/api-keys to get your free Sort API key.
 * See https://docs.sort.xyz for more information on the available queries.
 * See https://docs.sort.xyz/reference for more information about Sort's REST API.
 */

/**
 * Run the example.
 */
export const run = async () => {
  // Initialize the OpenAI model. Use OPENAI_API_KEY from .env in /examples
  const model = new OpenAI({ temperature: 0.9 });

  const apiKey = "YOUR_SORTXYZ_API_KEY";
  const contractAddress =
    "0x887F3909C14DAbd9e9510128cA6cBb448E932d7f".toLowerCase();

  /*
  Load NFT metadata from the Ethereum blockchain. Hint: to load by a specific ID, see SQL query example below.
  */

  const nftMetadataLoader = new SortXYZBlockchainLoader({
    apiKey,
    query: {
      type: "NFTMetadata",
      blockchain: "ethereum",
      contractAddress,
    },
  });

  const nftMetadataDocs = await nftMetadataLoader.load();

  const nftPrompt =
    "Describe the character with the attributes from the following json document in a 4 sentence story. ";
  const nftResponse = await model.invoke(
    nftPrompt + JSON.stringify(nftMetadataDocs[0], null, 2)
  );
  console.log(`user > ${nftPrompt}`);
  console.log(`chatgpt > ${nftResponse}`);

  /*
    Load the latest transactions for a contract address from the Ethereum blockchain.
  */
  const latestTransactionsLoader = new SortXYZBlockchainLoader({
    apiKey,
    query: {
      type: "latestTransactions",
      blockchain: "ethereum",
      contractAddress,
    },
  });

  const latestTransactionsDocs = await latestTransactionsLoader.load();

  const latestPrompt =
    "Describe the following json documents in only 4 sentences per document. Include as much detail as possible. ";
  const latestResponse = await model.invoke(
    latestPrompt + JSON.stringify(latestTransactionsDocs[0], null, 2)
  );
  console.log(`\n\nuser > ${nftPrompt}`);
  console.log(`chatgpt > ${latestResponse}`);

  /*
    Load metadata for a specific NFT by using raw SQL and the NFT index. See https://docs.sort.xyz for forumulating SQL.
  */

  const sqlQueryLoader = new SortXYZBlockchainLoader({
    apiKey,
    query: `SELECT * FROM ethereum.nft_metadata WHERE contract_address = '${contractAddress}' AND token_id = 1 LIMIT 1`,
  });

  const sqlDocs = await sqlQueryLoader.load();

  const sqlPrompt =
    "Describe the character with the attributes from the following json document in an ad for a new coffee shop. ";
  const sqlResponse = await model.invoke(
    sqlPrompt + JSON.stringify(sqlDocs[0], null, 2)
  );
  console.log(`\n\nuser > ${sqlPrompt}`);
  console.log(`chatgpt > ${sqlResponse}`);
};

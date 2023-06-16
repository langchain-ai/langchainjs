import { BlockchainPagesLoader } from 'langchain/document_loaders/web/blockchain';
import { OpenAI } from 'langchain/llms/openai';

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

  const apiKey = 'dd46a0ae-5a1a-4c6f-8328-46618c4a73d4';
  const contractAddress = '0x887F3909C14DAbd9e9510128cA6cBb448E932d7f'.toLowerCase();

  /*
  Load NFT metadata from the Ethereum blockchain. Hint: to load by a specific ID, see SQL query example below.
  */

  const nftMetadataLoader = new BlockchainPagesLoader({
    apiKey,
    query: {
      type: 'NFTMetadata',
      blockchain: 'ethereum',
      contractAddress
    }
  });

  const nftMetadataDocs = await nftMetadataLoader.load();

  const nft_prompt = "Describe the character with the attributes from the following json document in a 4 sentence story. ";
  const nft_res = await model.call(
    nft_prompt +
    JSON.stringify(nftMetadataDocs[0], null, 2)
  );
  console.log(`user > ${nft_prompt}`);
  console.log(`chatgpt > ${nft_res}`);

  /*
    Load the latest transactions for a contract address from the Ethereum blockchain.
  */
  const latestTransactionsLoader = new BlockchainPagesLoader({
    apiKey,
    query: {
      type: "latestTransactions",
      blockchain: "ethereum",
      contractAddress
    }
  });

  const latestTransactionsDocs = await latestTransactionsLoader.load();

  const latest_prompt = "Describe the following json documents in only 4 sentences per document. Include as much detail as possible. ";
  const latest_res = await model.call(
    latest_prompt +
    JSON.stringify(latestTransactionsDocs[0], null, 2)
  );
  console.log(`\n\nuser > ${nft_prompt}`);
  console.log(`chatgpt > ${latest_res}`);


  /*
    Load metadata for a specific NFT by using raw SQL and the NFT index. See https://docs.sort.xyz for forumulating SQL.
  */

  const sqlQueryLoader = new BlockchainPagesLoader({
    apiKey,
    query: `SELECT * FROM ethereum.nft_metadata WHERE contract_address = '${contractAddress}' AND token_id = 1 LIMIT 1`
  });

  const sqlDocs = await sqlQueryLoader.load();

  const sql_prompt = 'Describe the character with the attributes from the following json document in an ad for a new coffee shop. ';
  const sql_res = await model.call(
    sql_prompt +
    JSON.stringify(sqlDocs[0], null, 2)
  );
  console.log(`\n\nuser > ${sql_prompt}`);
  console.log(`chatgpt > ${sql_res}`);
};

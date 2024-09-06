import {
  JigsawStackAIScrape,
  JigsawStackAISearch,
  JigsawStackSpeechToText,
  JigsawStackVOCR,
  JigsawStackTextToSQL,
} from "@langchain/jigsawstack";

export const run = async () => {
  // AI Scrape Tool
  const aiScrapeTool = new JigsawStackAIScrape({
    params: {
      element_prompts: ["Pro plan"],
    },
  });
  const result = await aiScrapeTool.invoke("https://jigsawstack.com/pricing");

  console.log({ result });

  // AI Search Tool

  const aiSearchTool = new JigsawStackAISearch();
  const doc = await aiSearchTool.invoke("The leaning tower of pisa");
  console.log({ doc });

  // VOCR Tool

  const vocrTool = new JigsawStackVOCR({
    params: {
      prompt: "Describe the image in detail",
    },
  });
  const data = await vocrTool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z"
  );

  console.log({ data });

  // Speech-to-Text Tool
  const sttTool = new JigsawStackSpeechToText();
  await sttTool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Video%201737458382653833217.mp4?t=2024-03-22T09%3A50%3A49.894"
  );

  // Text-to-SQL Tool
  const sqlTool = new JigsawStackTextToSQL({
    params: {
      sql_schema:
        "CREATE TABLE Transactions (transaction_id INT PRIMARY KEY, user_id INT NOT NULL,total_amount DECIMAL(10, 2 NOT NULL, transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,status VARCHAR(20) DEFAULT 'pending',FOREIGN KEY(user_id) REFERENCES Users(user_id))",
    },
  });

  await sqlTool.invoke(
    "Generate a query to get transactions that amount exceed 10000 and sort by when created"
  );
};

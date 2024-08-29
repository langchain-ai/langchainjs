import { expect, test } from "@jest/globals";
import { JigsawStackAIScrape } from "../tools/ai-scrape.js";
import { JigsawStackSpeechToText } from "../tools/speech-to-text.js";
import { JigsawStackTextToSQL } from "../tools/text-to-sql.js";
import { JigsawStackAISearch } from "../tools/ai-search.js";
import { JigsawStackVOCR } from "../tools/vocr.js";

test("JigsawStackAIScrape can scrape a website given a url and prompt", async () => {
  const tool = new JigsawStackAIScrape({
    params: {
      element_prompts: ["Pro plan"],
    },
  });

  const toolData = await tool.invoke("https://jigsawstack.com/pricing");

  const parsedData = JSON.parse(toolData);
  // console.log("results:", parsedData.success);
  expect(parsedData.success).toBeTruthy();
});

test("JigsawStackVocr can perform vision ocr", async () => {
  const tool = new JigsawStackVOCR({
    params: {
      prompt: "Describe the image in detail",
    },
  });

  const toolData = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Collabo%201080x842.jpg?t=2024-03-22T09%3A22%3A48.442Z"
  );

  const parsedData = JSON.parse(toolData);
  expect(parsedData.success).toBe(true);
});

test("JigsawStackSpeechToText can transcribe video and audio given a file url", async () => {
  const tool = new JigsawStackSpeechToText();

  const metadata = await tool.invoke(
    "https://rogilvkqloanxtvjfrkm.supabase.co/storage/v1/object/public/demo/Video%201737458382653833217.mp4?t=2024-03-22T09%3A50%3A49.894"
  );
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.success).toBe(true);
});

test("JigsawStackTextToSQL can translate a prompt into a valid SQL query", async () => {
  const tool = new JigsawStackTextToSQL({
    params: {
      sql_schema:
        "CREATE TABLE Transactions (transaction_id INT PRIMARY KEY, user_id INT NOT NULL,total_amount DECIMAL(10, 2 NOT NULL, transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,status VARCHAR(20) DEFAULT 'pending',FOREIGN KEY(user_id) REFERENCES Users(user_id))",
    },
  });

  const metadata = await tool.invoke(
    "Generate a query to get transactions that amount exceed 10000 and sort by when created"
  );
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.success).toBe(true);
});

test("JigsawStackAISearch can perform AI search given a query", async () => {
  const tool = new JigsawStackAISearch();
  const metadata = await tool.invoke("The leaning tower of pisa");
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.ai_overview).toBeTruthy();
  expect(jsonData.success).toBe(true);
});

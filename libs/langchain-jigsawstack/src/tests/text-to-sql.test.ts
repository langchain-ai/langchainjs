import { it, expect } from "@jest/globals";
import { JigsawStackTextToSQL } from "../tools/text-to-sql.js";

it("text to sql should run successfully and return the sql result", async () => {
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

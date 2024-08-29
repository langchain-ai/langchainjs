import { it, expect } from "@jest/globals";
import { JigsawStackTextToSQL } from "../tools/text-to-sql.js";

it("text to sql should run successfully and return the sql result", async () => {
  const tool = new JigsawStackTextToSQL({
    params: {
      sql_schema:
        "CREATE TABLE Transactions (transaction_id INT PRIMARY KEY, user_id INT NOT NULL,total_amount DECIMAL(10, 2 NOT NULL, transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,status VARCHAR(20) DEFAULT 'pending',FOREIGN KEY(user_id) REFERENCES Users(user_id))",
    },
    apiKey:
      "sk_0b9b4fab624794c93fd423d4c079738a8bf0eed4b5c93dd4ac0d77b155c3d7ce91a572f60d1ac4d00a799d0f924d431f6ab42c4a128d689bdae69db59cf67b25024fS7GiEZWQ2HvXOHcdt",
  });

  const metadata = await tool.invoke(
    "Generate a query to get transactions that amount exceed 10000 and sort by when created"
  );
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.success).toBe(true);
});

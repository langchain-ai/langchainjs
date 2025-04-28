import type {
  BaseLanguageModel,
  BaseLanguageModelInterface,
} from "@langchain/core/language_models/base";
import type { TiktokenModel } from "js-tiktoken/lite";
import type { OpenAI } from "@langchain/openai";
import { ChainValues } from "@langchain/core/utils/types";
import { BasePromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import {
  calculateMaxTokens,
  getModelContextSize,
} from "@langchain/core/language_models/base";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  DEFAULT_SQL_DATABASE_PROMPT,
  SQL_PROMPTS_MAP,
  SqlDialect,
} from "./sql_db_prompt.js";
import { BaseChain, ChainInputs } from "../base.js";
import { LLMChain } from "../llm_chain.js";
import type { SqlDatabase } from "../../sql_db.js";
import { getPromptTemplateFromDataSource } from "../../util/sql_utils.js";

/**
 * Interface that extends the ChainInputs interface and defines additional
 * fields specific to a SQL database chain. It represents the input fields
 * for a SQL database chain.
 */
export interface SqlDatabaseChainInput extends ChainInputs {
  llm: BaseLanguageModelInterface;
  database: SqlDatabase;
  topK?: number;
  inputKey?: string;
  outputKey?: string;
  sqlOutputKey?: string;
  prompt?: PromptTemplate;
}

/**
 * Class that represents a SQL database chain in the LangChain framework.
 * It extends the BaseChain class and implements the functionality
 * specific to a SQL database chain.
 *
 * @security **Security Notice**
 * This chain generates SQL queries for the given database.
 * The SQLDatabase class provides a getTableInfo method that can be used
 * to get column information as well as sample data from the table.
 * To mitigate risk of leaking sensitive data, limit permissions
 * to read and scope to the tables that are needed.
 * Optionally, use the includesTables or ignoreTables class parameters
 * to limit which tables can/cannot be accessed.
 *
 * @link See https://js.langchain.com/docs/security for more information.
 * @example
 * ```typescript
 * const chain = new SqlDatabaseChain({
 *   llm: new OpenAI({ temperature: 0 }),
 *   database: new SqlDatabase({ ...config }),
 * });
 *
 * const result = await chain.run("How many tracks are there?");
 * ```
 */
export class SqlDatabaseChain extends BaseChain {
  static lc_name() {
    return "SqlDatabaseChain";
  }

  // LLM wrapper to use
  llm: BaseLanguageModelInterface;

  // SQL Database to connect to.
  database: SqlDatabase;

  // Prompt to use to translate natural language to SQL.
  prompt = DEFAULT_SQL_DATABASE_PROMPT;

  // Number of results to return from the query
  topK = 5;

  inputKey = "query";

  outputKey = "result";

  sqlOutputKey: string | undefined = undefined;

  // Whether to return the result of querying the SQL table directly.
  returnDirect = false;

  constructor(fields: SqlDatabaseChainInput) {
    super(fields);
    this.llm = fields.llm;
    this.database = fields.database;
    this.topK = fields.topK ?? this.topK;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.sqlOutputKey = fields.sqlOutputKey ?? this.sqlOutputKey;
    this.prompt =
      fields.prompt ??
      getPromptTemplateFromDataSource(this.database.appDataSource);
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const llmChain = new LLMChain({
      prompt: this.prompt,
      llm: this.llm,
      outputKey: this.outputKey,
      memory: this.memory,
    });
    if (!(this.inputKey in values)) {
      throw new Error(`Question key ${this.inputKey} not found.`);
    }
    const question: string = values[this.inputKey];
    let inputText = `${question}\nSQLQuery:`;
    const tablesToUse = values.table_names_to_use;
    const tableInfo = await this.database.getTableInfo(tablesToUse);

    const llmInputs = {
      input: inputText,
      top_k: this.topK,
      dialect: this.database.appDataSourceOptions.type,
      table_info: tableInfo,
      stop: ["\nSQLResult:"],
    };
    await this.verifyNumberOfTokens(inputText, tableInfo);

    const sqlCommand = await llmChain.predict(
      llmInputs,
      runManager?.getChild("sql_generation")
    );
    let queryResult = "";
    try {
      queryResult = await this.database.appDataSource.query(sqlCommand);
    } catch (error) {
      console.error(error);
    }

    let finalResult;
    if (this.returnDirect) {
      finalResult = { [this.outputKey]: queryResult };
    } else {
      inputText += `${sqlCommand}\nSQLResult: ${JSON.stringify(
        queryResult
      )}\nAnswer:`;
      llmInputs.input = inputText;
      finalResult = {
        [this.outputKey]: await llmChain.predict(
          llmInputs,
          runManager?.getChild("result_generation")
        ),
      };
    }

    if (this.sqlOutputKey != null) {
      finalResult[this.sqlOutputKey] = sqlCommand;
    }

    return finalResult;
  }

  _chainType() {
    return "sql_database_chain" as const;
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    if (this.sqlOutputKey != null) {
      return [this.outputKey, this.sqlOutputKey];
    }
    return [this.outputKey];
  }

  /**
   * Private method that verifies the number of tokens in the input text and
   * table information. It throws an error if the number of tokens exceeds
   * the maximum allowed by the language model.
   * @param inputText The input text.
   * @param tableinfo The table information.
   * @returns A promise that resolves when the verification is complete.
   */
  private async verifyNumberOfTokens(
    inputText: string,
    tableinfo: string
  ): Promise<void> {
    // We verify it only for OpenAI for the moment
    if (this.llm._llmType() !== "openai") {
      return;
    }
    const llm = this.llm as OpenAI;
    const promptTemplate = this.prompt.template;
    const stringWeSend = `${inputText}${promptTemplate}${tableinfo}`;

    const maxToken = await calculateMaxTokens({
      prompt: stringWeSend,
      // Cast here to allow for other models that may not fit the union
      modelName: llm.model as TiktokenModel,
    });

    if (maxToken < (llm.maxTokens ?? -1)) {
      throw new Error(`The combination of the database structure and your question is too big for the model ${
        llm.model
      } which can compute only a max tokens of ${getModelContextSize(
        llm.model
      )}.
      We suggest you to use the includeTables parameters when creating the SqlDatabase object to select only a subset of the tables. You can also use a model which can handle more tokens.`);
    }
  }
}

export interface CreateSqlQueryChainFields {
  llm: BaseLanguageModel;
  db: SqlDatabase;
  prompt?: BasePromptTemplate;
  /**
   * @default 5
   */
  k?: number;
  dialect: SqlDialect;
}

type SqlInput = {
  question: string;
};

type SqlInoutWithTables = SqlInput & {
  tableNamesToUse: string[];
};

const strip = (text: string) => {
  // Replace escaped quotes with actual quotes
  let newText = text.replace(/\\"/g, '"').trim();
  // Remove wrapping quotes if the entire string is wrapped in quotes
  if (newText.startsWith('"') && newText.endsWith('"')) {
    newText = newText.substring(1, newText.length - 1);
  }
  return newText;
};

const difference = (setA: Set<string>, setB: Set<string>) =>
  new Set([...setA].filter((x) => !setB.has(x)));

/**
 * Create a SQL query chain that can create SQL queries for the given database.
 * Returns a Runnable.
 *
 * @param {BaseLanguageModel} llm The language model to use in the chain.
 * @param {SqlDatabase} db The database to use in the chain.
 * @param {BasePromptTemplate | undefined} prompt The prompt to use in the chain.
 * @param {BaseLanguageModel | undefined} k The amount of docs/results to return. Passed through the prompt input value `top_k`.
 * @param {SqlDialect} dialect The SQL dialect to use in the chain.
 * @returns {Promise<RunnableSequence<Record<string, unknown>, string>>} A runnable sequence representing the chain.
 * @example ```typescript
 * const datasource = new DataSource({
 *   type: "sqlite",
 *   database: "../../../../Chinook.db",
 * });
 * const db = await SqlDatabase.fromDataSourceParams({
 *   appDataSource: datasource,
 * });
 * const llm = new ChatOpenAI({ temperature: 0 });
 * const chain = await createSqlQueryChain({
 *   llm,
 *   db,
 *   dialect: "sqlite",
 * });
 * ```
 */
export async function createSqlQueryChain({
  llm,
  db,
  prompt,
  k = 5,
  dialect,
}: CreateSqlQueryChainFields) {
  let promptToUse: BasePromptTemplate;
  if (prompt) {
    promptToUse = prompt;
  } else if (SQL_PROMPTS_MAP[dialect]) {
    promptToUse = SQL_PROMPTS_MAP[dialect];
  } else {
    promptToUse = DEFAULT_SQL_DATABASE_PROMPT;
  }

  if (
    difference(
      new Set(["input", "top_k", "table_info"]),
      new Set(promptToUse.inputVariables)
    ).size > 0
  ) {
    throw new Error(
      `Prompt must have input variables: 'input', 'top_k', 'table_info'. Received prompt with input variables: ` +
        `${promptToUse.inputVariables}. Full prompt:\n\n${promptToUse}`
    );
  }
  if (promptToUse.inputVariables.includes("dialect")) {
    promptToUse = await promptToUse.partial({ dialect });
  }

  promptToUse = await promptToUse.partial({ top_k: k.toString() });

  const inputs = {
    input: (x: Record<string, unknown>) => {
      if ("question" in x) {
        return `${(x as SqlInput).question}\nSQLQuery: `;
      }
      throw new Error("Input must include a question property.");
    },
    table_info: async (x: Record<string, unknown>) =>
      db.getTableInfo((x as SqlInoutWithTables).tableNamesToUse),
  };

  return RunnableSequence.from([
    RunnablePassthrough.assign(inputs),
    (x) => {
      const newInputs = { ...x };
      delete newInputs.question;
      delete newInputs.tableNamesToUse;
      return newInputs;
    },
    promptToUse,
    llm.bind({ stop: ["\nSQLResult:"] }),
    new StringOutputParser(),
    strip,
  ]);
}

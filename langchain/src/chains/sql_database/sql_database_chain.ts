import { DEFAULT_SQL_DATABASE_PROMPT } from './sql_database_prompt.js';
import { BaseChain, ChainValues } from '../base.js';
import { BaseMemory } from '../../memory/index.js';
import { BaseLLM } from '../../llms/index.js';
import { LLMChain } from '../llm_chain.js';
import { SQLDatabase } from '../../sql_database.js';

export type SerializedSqlDatabaseChain = {
    _type: "sql_database_chain";
    sql_database_chain_path?: string;
};

export class SqlDatabaseChain extends BaseChain {
    llm: BaseLLM;

   // LLM wrapper to use.
    database: SQLDatabase;

   // SQL Database to connect to.
    prompt = DEFAULT_SQL_DATABASE_PROMPT;

   // Prompt to use to translate natural language to SQL.
    topK = 5;

   // Number of results to return from the query
    inputKey = "query";

    outputKey = "result";

    returnIntermediateSteps = false;

   // Whether or not to return the intermediate steps along with the final answer.
    returnDirect = false;
   // Whether or not to return the result of querying the SQL table directly.

    constructor(fields: {
        llm: BaseLLM;
        database: SQLDatabase;
        inputKey?: string;
        outputKey?: string;
        memory?: BaseMemory;
    }) {
        const {memory} = fields;
        super(memory);
        this.llm = fields.llm;
        this.database = fields.database;
        this.inputKey = fields.inputKey ?? this.inputKey;
        this.outputKey = fields.outputKey ?? this.outputKey;
    }
    
    async _call(values: ChainValues): Promise<ChainValues> {
        const lLMChain = new LLMChain({
            prompt: this.prompt,
            llm: this.llm,
            outputKey: this.outputKey,
            memory: this.memory
        });
        if (!(this.inputKey in values)) {
            throw new Error(`Question key ${this.inputKey} not found.`);
        }
        const question: string = values[this.inputKey];
        let inputText = `${question  }\nSQLQuery:`;
        console.info(inputText);
        const tablesToUse = values.table_names_to_use;
        const tableInfo = await this.database.getTableInfo(tablesToUse);

        console.log('Tableinfo', tableInfo);

        const llmInputs = {
            "input": inputText,
            "top_k": this.topK,
            "dialect": this.database.appDataSource.options.type,
            "table_info": tableInfo,
            "stop": ["\nSQLResult:"],
        };

        const intermediateStep = [];
        const sqlCommand = await lLMChain.predict(llmInputs);
        intermediateStep.push(sqlCommand);
        console.info(sqlCommand);
        let queryResult = '';
        try {
            queryResult = await this.database.appDataSource.query(sqlCommand);
            intermediateStep.push(queryResult);
        } catch (error) {
            console.error(error);
        }

        let finalResult;
        if (this.returnDirect) {
            finalResult = { result: queryResult };
        } else {
            inputText +=`${+ sqlCommand  }\nSQLResult: ${  JSON.stringify(queryResult)  }\nAnswer:`;
            llmInputs.input = inputText;
            finalResult = { result: await lLMChain.predict(llmInputs)};
        }

        return finalResult;
    }

    _chainType() {
        return 'sql_database_chain' as const;
    }

    get inputKeys(): string[] {
        return [this.inputKey];
    }

    serialize(): SerializedSqlDatabaseChain {
        return {
            _type: this._chainType(),
        };
    }

}
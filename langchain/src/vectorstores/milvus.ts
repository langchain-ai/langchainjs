import { v4 as uuidv4 } from "uuid";
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { Collection } from "@zilliz/milvus2-sdk-node/dist/milvus/Collection.js";
import { DataType, DataTypeMap } from '@zilliz/milvus2-sdk-node/dist/milvus/const/Milvus.js';
import { Index } from '@zilliz/milvus2-sdk-node/dist/milvus/MilvusIndex.js';
import { ErrorCode, FieldType, InsertReq, SearchReq } from '@zilliz/milvus2-sdk-node/dist/milvus/types.js';
import { Data } from '@zilliz/milvus2-sdk-node/dist/milvus/Data.js';

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from './base.js';
import { Document } from '../document.js';

export interface MilvusLibArgs {
    collectionName?: string
    primaryField?: string
    vectorField?: string
    textField?: string
    url?: string, //db address
    ssl?: boolean,
    username?: string,
    password?: string
}


type IndexType = "IVF_FLAT" | "IVF_SQ8" | "IVF_PQ" | "HNSW" | "RHNSW_FLAT" | "RHNSW_SQ" | "RHNSW_PQ" | "IVF_HNSW" | "ANNOY";

interface IndexParam {
    params: { nprobe?: number, ef?: number, search_k?: number }
}

const MILVUS_PRIMARY_FIELD_NAME = "langchain_primaryid"
const MILVUS_VECTOR_FIELD_NAME = "langchain_vector"
const MILVUS_TEXT_FIELD_NAME = "langchain_text"
const MILVUS_COLLECTION_NAME_PREFIX = "langchain_col"
const MILVUS_INDEX_CREATE_PARAMS = {
    index_type: "HNSW",
    metric_type: "L2",
    params: JSON.stringify({ "M": 8, "efConstruction": 64 })
}
const MILVUS_INDEX_SEARCH_PARAMS = JSON.stringify({"ef": 64})


export class Milvus extends VectorStore {
    collectionName: string;
    numDimensions?: number;
    autoId?: boolean;
    primaryField: string;
    vectorField: string;
    textField: string;
    fields: string[];
    client: MilvusClient;
    colMgr: Collection;
    idxMgr: Index;
    dataMgr: Data;

    indexParams: Record<IndexType, IndexParam> = {
        IVF_FLAT: { params: { nprobe: 10 } },
        IVF_SQ8: { params: { nprobe: 10 } },
        IVF_PQ: { params: { nprobe: 10 } },
        HNSW: { params: { ef: 10 } },
        RHNSW_FLAT: { params: { ef: 10 } },
        RHNSW_SQ: { params: { ef: 10 } },
        RHNSW_PQ: { params: { ef: 10 } },
        IVF_HNSW: { params: { nprobe: 10, ef: 10 } },
        ANNOY: { params: { search_k: 10 } },
    }

    constructor(embeddings: Embeddings, args: MilvusLibArgs) {
        super(embeddings, args);
        this.embeddings = embeddings;
        this.collectionName = args.collectionName ?? genCollectionName();
        this.textField = args.textField ?? MILVUS_TEXT_FIELD_NAME;

        this.autoId = true;
        this.primaryField = args.primaryField ?? MILVUS_PRIMARY_FIELD_NAME;
        this.vectorField = args.vectorField ?? MILVUS_VECTOR_FIELD_NAME;
        this.fields = [];

        const url = args.url ?? process.env.MILVUS_URL;
        if (!url) {
            throw new Error("Milvus URL address is not provided.");
        }
        this.client = new MilvusClient(
            url,
            args.ssl,
            args.username,
            args.password
        );
        this.colMgr = this.client.collectionManager;
        this.idxMgr = this.client.indexManager;
        this.dataMgr = this.client.dataManager;
    }


    async addDocuments(documents: Document[]): Promise<void> {
        const texts = documents.map(({ pageContent }) => pageContent)
        await this.addVectors(
            await this.embeddings.embedDocuments(texts),
            documents
        );
    }

    async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
        if (vectors.length === 0) {
            return;
        }
        await this.ensureCollection(vectors, documents);

        const insertDatas: { [x: string]: any; }[] = []
        for (let index = 0; index < vectors.length; index++) {
            const vec = vectors[index];
            const doc = documents[index];
            let data: { [x: string]: any; } = {
                [this.textField]: doc.pageContent,
                [this.vectorField]: vec
            }
            this.fields.forEach((field: string) => {
                switch (field) {
                    case this.primaryField:
                        if (!this.autoId) {
                            if (doc.metadata[this.primaryField] === undefined) {
                                throw new Error(`The Collection's primaryField is configured with autoId=false, thus its value must be provided through metadata.`);
                            }
                            data[field] = doc.metadata[this.primaryField]
                        }
                        break
                    case this.textField:
                        data[field] = doc.pageContent
                        break
                    case this.vectorField:
                        data[field] = vec
                        break;
                    default:
                        if (doc.metadata[field] === undefined) {
                            throw new Error(`The field "${field}" is not provided in documents[${index}].metadata.`)
                        } else {
                            data[field] = doc.metadata[field]
                        }
                        break;
                }
            })

            insertDatas.push(data)
        }

        const insertReq: InsertReq = {
            collection_name: this.collectionName,
            fields_data: insertDatas,
        }

        // console.log("Inserting data: " + JSON.stringify(insertReq));
        const insertResp = await this.dataMgr.insert(insertReq)
        if (insertResp.status.error_code != ErrorCode.SUCCESS) {
            throw new Error("Error inserting data: " + JSON.stringify(insertResp));
        }
        await this.dataMgr.flushSync({ collection_names: [this.collectionName] })
    }




    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const hasColResp = await this.colMgr.hasCollection({ collection_name: this.collectionName })
        if (hasColResp.status.error_code != ErrorCode.SUCCESS) {
            throw new Error("Error checking collection: " + hasColResp);
        }
        if (hasColResp.value === false) {
            throw new Error("Collection not found: " + this.collectionName + ", please create collection before search.");
        }

        await this.grabCollectionFields();

        const loadResp = await this.colMgr.loadCollectionSync({collection_name: this.collectionName})
        if (loadResp.error_code != ErrorCode.SUCCESS) {
            throw new Error("Error loading collection: " + loadResp);
        }

        // clone this.field and remove vectorField
        let outputFields = this.fields.filter((field) => field !== this.vectorField)

        const searchReq: SearchReq = {
            collection_name : this.collectionName,
            search_params: {
                anns_field: this.vectorField,
                topk: k.toString(),
                metric_type: MILVUS_INDEX_CREATE_PARAMS.metric_type,
                params: MILVUS_INDEX_SEARCH_PARAMS,
            },
            output_fields: outputFields,
            vector_type: DataType.FloatVector,
            vectors: [query],
        }
        
        const searchResp = await this.dataMgr.search(searchReq)
        if (searchResp.status.error_code != ErrorCode.SUCCESS) {
            throw new Error("Error searching data: " + JSON.stringify(searchResp));
        }
        const results:[Document, number][] = []
        searchResp.results.forEach((result)=>{
            var doc = new Document()
            Object.keys(result).forEach((key)=>{
                if (key == this.textField) {
                    doc.pageContent = result[key]
                }else{
                    if (this.fields.includes(key)) {
                        doc.metadata[key] = result[key]
                    }
                }
            })
            results.push([doc, result.score])
        })
        // console.log("Search result: " + JSON.stringify(results, null, 2));
        return results;
    }

    async ensureCollection(vectors: number[][], documents: Document[]) {
        const hasColResp = await this.colMgr.hasCollection({ collection_name: this.collectionName })
        if (hasColResp.status.error_code != ErrorCode.SUCCESS) {
            throw new Error("Error checking collection: " + JSON.stringify(hasColResp, null, 2) );
        }

        if (hasColResp.value === false) {
            await this.createCollection(vectors, documents);
        } else {
            await this.grabCollectionFields();
        }
    }

    async createCollection(vectors: number[][], documents: Document[]): Promise<void> {
        let fieldList: FieldType[] = []

        let sampleMetadata = documents[0].metadata
        documents.forEach(({ metadata }) => {
            // check all keys name and count in metadata is same as sampleMetadata
            Object.keys(metadata).forEach((key) => {
                if (!(key in sampleMetadata)) {
                    throw new Error("All documents must have same metadata keys and datatype")
                }
            })
        })

        fieldList.push(...createFieldTypeForMetadata(documents[0].metadata))

        fieldList.push({
            name: this.primaryField,
            description: "Primary key",
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: this.autoId,
        },
            {
                name: this.textField,
                description: "Text field",
                data_type: DataType.VarChar,
                type_params: {
                    max_length: getTextFieldMaxLength(documents).toString(),
                }
            },
            {
                name: this.vectorField,
                description: "Vector field",
                data_type: DataType.FloatVector,
                type_params: {
                    dim: getVectorFieldDim(vectors).toString()
                }
            })

        fieldList.forEach((field) => {
            if (!field.autoID) {
                this.fields.push(field.name)
            }
        })

        let createRes = await this.colMgr.createCollection({
            collection_name: this.collectionName,
            fields: fieldList
        })



        if (createRes.error_code != ErrorCode.SUCCESS) {
            console.log(createRes)
            throw new Error(`Failed to create collection: ${createRes}`);
        }

        await this.idxMgr.createIndex({
            collection_name: this.collectionName,
            field_name: this.vectorField,
            extra_params: MILVUS_INDEX_CREATE_PARAMS
        })
    }

    async grabCollectionFields(): Promise<void> {
        if (this.collectionName == undefined) {
            throw new Error("Need collection name to grab collection fields");
        }
        if (this.primaryField &&
            this.vectorField &&
            this.textField &&
            this.fields.length > 0) {
            return;
        }
        const desc = await this.colMgr.describeCollection({
            collection_name: this.collectionName,
        });
        desc.schema.fields.forEach(field => {
            this.fields.push(field.name);
            if (field.autoID) {
                const index = this.fields.indexOf(field.name);
                if (index != -1) {
                    this.fields.splice(index, 1);
                }
            }
            if (field.is_primary_key) {
                this.primaryField = field.name;
            }
            const dtype = DataTypeMap[field.data_type.toLowerCase()];
            if (dtype == DataType.FloatVector ||
                dtype == DataType.BinaryVector
            ) {
                this.vectorField = field.name;
            }

            if (dtype == DataType.VarChar && field.name == MILVUS_TEXT_FIELD_NAME) {
                this.textField = field.name;
            }
        })
    }

    static async fromTexts(texts: string[],
        metadatas: object[] | object,
        embeddings: Embeddings,
        dbConfig?: {
            collectionName?: string;
            url?: string;
        }): Promise<Milvus> {
        const docs: Document[] = [];
        for (let i = 0; i < texts.length; i += 1) {
            const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
            const newDoc = new Document({
                pageContent: texts[i],
                metadata,
            });
            docs.push(newDoc);
        }
        return await Milvus.fromDocuments(docs, embeddings, dbConfig)
    }

    static async fromDocuments(docs: Document[], embeddings: Embeddings, dbConfig?: MilvusLibArgs): Promise<Milvus> {
        const args: MilvusLibArgs = {
            collectionName: dbConfig?.collectionName || genCollectionName(),
            url: dbConfig?.url || process.env.MILVUS_URL,
        }
        const instance = new this(embeddings, args)
        await instance.addDocuments(docs)
        return instance
    }
}


function createFieldTypeForMetadata(metadata: Record<string, any>): FieldType[] {
    const fields: FieldType[] = [];
    for (const [key, value] of Object.entries(metadata)) {
        if (Array.isArray(value)) {
            throw new Error(`Unsupported type array for metadata field`);
        } else {
            const type = typeof value;
            if (type === "string") {
                fields.push({
                    name: key,
                    description: `Metadata String field`,
                    data_type: DataType.VarChar,
                    type_params: {
                        max_length: value.length.toString(),
                    }
                });
            } else if (type === "number") {
                fields.push({
                    name: key,
                    description: `Metadata Number field`,
                    data_type: DataType.Float,
                });
            } else if (type === "boolean") {
                fields.push({
                    name: key,
                    description: `Metadata Boolean field`,
                    data_type: DataType.Bool,
                });
            } else if (value === null) {
                // skip
            } else {
                throw new Error(`Unsupported type ${type} for metadata field`);
            }
        }
    }
    return fields;
}

function genCollectionName() : string {
    return `${MILVUS_COLLECTION_NAME_PREFIX}_${uuidv4().replaceAll('-', '')}`;
}

function getTextFieldMaxLength(documents: Document[]) {
    let textMaxLength = 0;
    for (let i = 0; i < documents.length; i++) {
        const text = documents[i].pageContent;
        if (text.length > textMaxLength) {
            textMaxLength = text.length;
        }
    }
    return textMaxLength;
}

function getVectorFieldDim(vectors: number[][]) {
    if (vectors.length === 0) {
        throw new Error("No vectors found");
    }
    return vectors[0].length;
} 
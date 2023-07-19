import { similarity as ml_distance_similarity } from "ml-distance";
import { Document } from "langchain/document";
import { VectorStore } from 'langchain/vectorstores/base';

export class IndexedDBVectorStore extends VectorStore {
     constructor(embeddings, args) {
        super(embeddings, args);
        Object.defineProperty(this, "dbName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "storeName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dbVersion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "memoryVectors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "similarity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.similarity = args.similarity ?? ml_distance_similarity.cosine;
        this.dbName = args.dbName || "IndexedVectorDB";;
        this.storeName = args.storeName || "storeDefault";
        this.dbVersion = args.dbVersion || 1;
    }
    async addDocuments(documents) {
        const texts = documents.map(({ pageContent }) => pageContent);
        return this.addVectors(await this.embeddings.embedDocuments(texts), documents);
    }
    async addVectors(vectors, documents) {
        const newVectors = vectors.map((embedding, idx) => ({
            embedding,
            content: documents[idx].pageContent,
            metadata: documents[idx].metadata,
        }));
         
        for (const vect of newVectors) {
            try {
                await insertRecord(this.db, this.storeName, vect);
                this.memoryVectors.push(vect);
            } catch (error) { // avoid duplicated insert of same content
               console.error("####### insert record to IndexedDB error : "+error, "  ##metadata:"+vect.metadata)
            }           
        }   
    }
    async similaritySearchVectorWithScore(query, k, filter) {
        const filterFunction = (memoryVector) => {
            if (!filter) {
                return true;
            }
            const doc = new Document({
                metadata: memoryVector.metadata,
                pageContent: memoryVector.content,
            });
            return filter(doc);
        };
        const filteredMemoryVectors = this.memoryVectors.filter(filterFunction);
        const searches = filteredMemoryVectors
            .map((vector, index) => ({
            similarity: this.similarity(query, vector.embedding),
            index,
        }))
            .sort((a, b) => (a.similarity > b.similarity ? -1 : 0))
            .slice(0, k);
        const result = searches.map((search) => [
            new Document({
                metadata: filteredMemoryVectors[search.index].metadata,
                pageContent: filteredMemoryVectors[search.index].content,
            }),
            search.similarity,
        ]);
        return result;
    }
    static async fromTexts(texts, metadatas, embeddings, dbConfig) {
        const docs = [];
        for (let i = 0; i < texts.length; i += 1) {
            const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
            const newDoc = new Document({
                pageContent: texts[i],
                metadata,
            });
            docs.push(newDoc);
        }
        return MemoryVectorStore.fromDocuments(docs, embeddings, dbConfig);
    }
    static async fromDocuments(docs, embeddings, dbConfig) {
        let instance = new this(embeddings, dbConfig);
        instance=await initDBInstance(instance)    
        await instance.addDocuments(docs);
        return instance;
    }
    static async fromExistingIndex(embeddings, dbConfig) {
        let instance = new this(embeddings, dbConfig);
        instance=await initDBInstance(instance)  
        return instance;
    }
    
}

async function initDBInstance(instance ) {
    instance.db=  await openDB(instance.dbName, instance.storeName, instance.dbVersion) 
    // load db records into memoryVectors to improve similaritySearch performance
    const allRecords=await fetchRecords(instance.db, instance.storeName,  { limit: -1 })
    for (const record of allRecords) {
        let memoryVector={
            embedding : record.data.embedding,
            content: record.data.content ,
            metadata: record.data.metadata ,
        }
        instance.memoryVectors.push(memoryVector);
    }
    return instance
}
async function openDB(dbName, storeName, version = 1) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      request.onsuccess = function (event) {
        db = event.target.result;  
        resolve(db);
      };
      request.onerror = function (event) {
        reject(event.target.error);
      };
      request.onupgradeneeded = function (event) {
        db = event.target.result;  
        var objectStore;
        objectStore = db.createObjectStore(storeName, {
            autoIncrement: true  
        });
        objectStore.createIndex("metadata", "metadata",  { unique: false }); 
        objectStore.createIndex("embedding", "embedding", {unique: true,});
        resolve(db);
      };
    });
}
async function insertRecord(db, storeName, data) {
    var request = db
      .transaction([storeName], "readwrite")  
      .objectStore(storeName)  
      .add(data);
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        } 
    });
}
async function fetchRecords(db, storeName, options = { limit: 10 }) {
    const { limit } = options;
    const transaction = db.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.openCursor();
    const records = []
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          records.push({ data: cursor.value, key: cursor.key });
          cursor.continue();
        } else {
            if (limit != -1)
                resolve(records.slice(0, limit));
            else 
                resolve(records);
        }
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
}

  
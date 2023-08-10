/* eslint-disable @typescript-eslint/no-explicit-any */

import {expect, jest, test} from "@jest/globals";

import {DocumentCollection, NotFoundError, ZepClient} from "@getzep/zep-js";
import {IZepConfig, ZepVectorStore} from "../zep.js";
import {Embeddings} from "../../embeddings/base.js";
import {FakeEmbeddings} from "../../embeddings/fake.js";


jest.mock('@getzep/zep-js');

const mockDocuments = [
    {
        pageContent: "foo bar baz",
        metadata: {bar: "baz"},
    },
    {
        pageContent: "foo qux baz",
        metadata: {qux: "bar"},
    },
    {
        pageContent: "foo bar baz",
        metadata: {foo: "bar"},
    }
]

const mockCollection = {
    addDocuments: jest.fn<DocumentCollection["addDocuments"]>().mockResolvedValue(["uuid1", "uuid2", "uuid3"]),
    search: jest.fn<DocumentCollection["search"]>().mockResolvedValue(mockDocuments as any),
    deleteDocument: jest.fn<DocumentCollection["deleteDocument"]>().mockResolvedValue(undefined as any),
} as any;

const mockClient = {
    document: {
        getCollection: jest.fn<any>().mockResolvedValue(mockCollection),
        addCollection: jest.fn<any>().mockResolvedValue(mockCollection)
    }
} as any;


describe('ZepVectorStore', () => {
    let zepConfig: IZepConfig;
    let embeddings: Embeddings;

    beforeEach(() => {
        zepConfig = {
            apiUrl: 'http://api.zep.com',
            apiKey: '123456',
            collectionName: 'testCollection',
            description: 'Test Description',
            metadata: {},
            embeddingDimensions: 100,
            isAutoEmbedded: true
        };
        embeddings = new FakeEmbeddings();

        jest.spyOn(ZepClient, 'init').mockImplementation(() => Promise.resolve(mockClient));
    });

    test('should instantiate class successfully when a Collection exists', async () => {
        new ZepVectorStore(embeddings, zepConfig);

        // Wait for any promises in constructor to resolve
        await new Promise(setImmediate);

        expect(ZepClient.init).toHaveBeenCalledWith(zepConfig.apiUrl, zepConfig.apiKey);
        expect(mockClient.document.getCollection).toHaveBeenCalledWith(zepConfig.collectionName);
    });

    test('should instantiate class successfully when a Collection does not exist', async () => {
        mockClient.document.getCollection.mockRejectedValueOnce(new NotFoundError("Collection not found"));

        new ZepVectorStore(embeddings, zepConfig);

        // Wait for any promises in constructor to resolve
        await new Promise(setImmediate);

        expect(ZepClient.init).toHaveBeenCalledWith(zepConfig.apiUrl, zepConfig.apiKey);
        expect(mockClient.document.getCollection).toHaveBeenCalledWith(zepConfig.collectionName);
        expect(mockClient.document.addCollection).toHaveBeenCalledWith({
            name: zepConfig.collectionName,
            description: zepConfig.description,
            metadata: zepConfig.metadata,
            embeddingDimensions: zepConfig.embeddingDimensions,
            isAutoEmbedded: zepConfig.isAutoEmbedded
        });
    });

    test('should add documents successfully', async () => {
        const zepVectorStore = new ZepVectorStore(embeddings, zepConfig);

        (zepVectorStore as any).collection = mockCollection;

        const result = await zepVectorStore.addDocuments(mockDocuments);

        expect(mockCollection.addDocuments).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({content: 'foo bar baz', metadata: {bar: 'baz'}}),
            expect.objectContaining({content: 'foo qux baz', metadata: {qux: 'bar'}}),
            expect.objectContaining({content: 'foo bar baz', metadata: {foo: 'bar'}}),
        ]));

        expect(result).toEqual(["uuid1", "uuid2", "uuid3"]);
    });


});

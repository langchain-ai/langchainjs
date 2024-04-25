import { Document } from "@langchain/core/documents";

interface Metadata {
    name: string;
    date: string;
    count: number;
    is_active: boolean;
    tags: string[];
    location: number[];
    id: number;
    height: number | null;
    happiness: number | null;
    sadness?: number;
}

const metadatas: Metadata[] = [
    {
        name: "adam",
        date: "2021-01-01",
        count: 1,
        is_active: true,
        tags: ["a", "b"],
        location: [1.0, 2.0],
        id: 1,
        height: 10.0,
        happiness: 0.9,
        sadness: 0.1,
    },
    {
        name: "bob",
        date: "2021-01-02",
        count: 2,
        is_active: false,
        tags: ["b", "c"],
        location: [2.0, 3.0],
        id: 2,
        height: 5.7,
        happiness: 0.8,
        sadness: 0.1,
    },
    {
        name: "jane",
        date: "2021-01-01",
        count: 3,
        is_active: true,
        tags: ["b", "d"],
        location: [3.0, 4.0],
        id: 3,
        height: 2.4,
        happiness: null,
    },
];

const texts: string[] = metadatas.map(metadata => `id ${metadata.id} `);

export const DOCUMENTS: Document[] = texts.map((text, index) => new Document({ pageContent: text, metadata: metadatas[index] }));

interface TestCase {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: Record<string, any>;
    expected: number[];
}

export const TYPE_1_FILTERING_TEST_CASES: TestCase[] = [
    { filter: { id: 1 }, expected: [1] },
    { filter: { name: "adam" }, expected: [1] },
    { filter: { is_active: true }, expected: [1, 3] },
    { filter: { is_active: false }, expected: [2] },
    { filter: { id: 1, is_active: true }, expected: [1] },
    { filter: { id: 1, is_active: false }, expected: [] },
];

export const TYPE_2_FILTERING_TEST_CASES: TestCase[] = [
    { filter: { id: 1 }, expected: [1] },
    { filter: { id: { "$ne": 1 } }, expected: [2, 3] },
    { filter: { id: { "$gt": 1 } }, expected: [2, 3] },
    { filter: { id: { "$gte": 1 } }, expected: [1, 2, 3] },
    { filter: { id: { "$lt": 1 } }, expected: [] },
    { filter: { id: { "$lte": 1 } }, expected: [1] },
    { filter: { name: "adam" }, expected: [1] },
    { filter: { name: "bob" }, expected: [2] },
    { filter: { name: { "$eq": "adam" } }, expected: [1] },
    { filter: { name: { "$ne": "adam" } }, expected: [2, 3] },
    { filter: { name: { "$gt": "jane" } }, expected: [] },
    { filter: { name: { "$gte": "jane" } }, expected: [3] },
    { filter: { name: { "$lt": "jane" } }, expected: [1, 2] },
    { filter: { name: { "$lte": "jane" } }, expected: [1, 2, 3] },
    { filter: { is_active: { "$eq": true } }, expected: [1, 3] },
    { filter: { is_active: { "$ne": true } }, expected: [2] },
    { filter: { height: { "$gt": 5.0 } }, expected: [1, 2] },
    { filter: { height: { "$gte": 5.0 } }, expected: [1, 2] },
    { filter: { height: { "$lt": 5.0 } }, expected: [3] },
    { filter: { height: { "$lte": 5.8 } }, expected: [2, 3] },
];

export const TYPE_3_FILTERING_TEST_CASES: TestCase[] = [
    { filter: { "$or": [{ id: 1 }, { id: 2 }] }, expected: [1, 2] },
    { filter: { "$or": [{ id: 1 }, { name: "bob" }] }, expected: [1, 2] },
    { filter: { "$and": [{ id: 1 }, { id: 2 }] }, expected: [] },
    { filter: { "$or": [{ id: 1 }, { id: 2 }, { id: 3 }] }, expected: [1, 2, 3] },
];

export const TYPE_4_FILTERING_TEST_CASES: TestCase[] = [
    { filter: { id: { "$between": [1, 2] } }, expected: [1, 2] },
    { filter: { id: { "$between": [1, 1] } }, expected: [1] },
    { filter: { name: { "$in": ["adam", "bob"] } }, expected: [1, 2] },
];

export const TYPE_5_FILTERING_TEST_CASES: TestCase[] = [
    { filter: { name: { "$like": "a%" } }, expected: [1] },
    { filter: { name: { "$like": "%a%" } }, expected: [1, 3] },
];

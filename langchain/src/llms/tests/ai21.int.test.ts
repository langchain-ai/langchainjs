import { test, describe, expect, beforeEach, jest } from "@jest/globals";
import { AI21 } from "../ai21.js";


let mockData = {
    completions: [{ data: { text: 'Test Text' } }]
};

let ai21: AI21;
let fetchMock: { (input: RequestInfo | URL, init?: RequestInit | undefined): Promise<Response>; mockImplementationOnce?: any; };

describe('AI21', () => {
    beforeEach(() => {
        fetchMock = jest.fn((
            _input: RequestInfo | URL,
            _init?: RequestInit | undefined,
        ) => Promise.resolve(new Response())) as jest.MockedFunction<typeof fetch>;
        global.fetch = fetchMock;
        ai21 = new AI21({ ai21_api_key: 'test' });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    test('returns text data from the response when the request is successful', async () => {

        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
        );
        const result = await ai21.call('prompt');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result).toBe('Test Text');
    });

    it('throws an error when response status is not ok', async () => {
        fetchMock.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            status: 400
        }));
        await expect(ai21.call('Test prompt')).rejects.toThrow('AI21 /complete call failed with status code 400');
    });
    it('throws an error when no completions found in the response', async () => {
        mockData = {
            completions: []
        };
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData),
            })
        );
        await expect(ai21.call('Test prompt')).rejects.toThrow('No completions found in response');
    });
});
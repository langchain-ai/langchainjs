import { expect, jest } from "@jest/globals";

import {
  ZepClient,
  SearchResult,
  Memory,
  MemoryData,
  MessageData,
  NotFoundError,
} from "@getzep/zep-js";

import { ZepChatMessageHistory } from "../zep_memory.js";

import {
  AIChatMessage,
  HumanChatMessage,
} from '../../schema/index.js';

jest.mock('@getzep/zep-js');

describe('ZepChatMessageHistory', () => {
  const sessionID = 'session1';
  const url = 'http://localhost:8000';

  let zepClientMock: jest.Mocked<ZepClient>;
  let zepChatHistory: ZepChatMessageHistory;

  beforeEach(() => {
    zepClientMock = new ZepClient(url) as jest.Mocked<ZepClient>;
    zepChatHistory = new ZepChatMessageHistory(sessionID, url);
    zepClientMock.addMemory.mockResolvedValueOnce('session1');
    zepClientMock.getMemory.mockResolvedValue({} as Memory);
    zepClientMock.searchMemory.mockResolvedValue([] as SearchResult[]);
    zepClientMock.deleteMemory.mockResolvedValue('session1');
});

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addAIChatMessage', () => {
    it('should add an AI chat message to Zep memory', async () => {
      const message = 'Hello, I am an AI message';

      await zepChatHistory.addAIChatMessage(message);

      expect(zepClientMock.addMemory).toHaveBeenCalledWith(sessionID, expect.any(Object));
    });
  });

  describe('addUserMessage', () => {
    it('should add a user message to Zep memory', async () => {
      const message = 'Hello, I am a user message';

      await zepChatHistory.addUserMessage(message);

      expect(zepClientMock.addMemory).toHaveBeenCalledWith(sessionID, expect.any(Object));
    });
  });

  describe('getMessages', () => {
    it('should retrieve chat messages from Zep memory', async () => {
      const zepMemory: Memory = {
        messages: [
          { role: 'human', content: 'Message 1', toDict: jest.fn() as () => MessageData },
          { role: 'ai', content: 'Message 2', toDict: jest.fn() as () => MessageData },
        ],
        metadata: {},
        toDict: jest.fn() as () => MemoryData,
      };
  
      zepClientMock.getMemory.mockResolvedValueOnce(zepMemory);
  
      const messages = await zepChatHistory.getMessages();
  
      expect(zepClientMock.getMemory).toHaveBeenCalledWith(sessionID);
      expect(messages.length).toBe(2);
      expect(messages[0]).toBeInstanceOf(HumanChatMessage);
      expect((messages[0] as HumanChatMessage).text).toBe('Message 1');
      expect(messages[1]).toBeInstanceOf(AIChatMessage);
      expect((messages[1] as AIChatMessage).text).toBe('Message 2');
    });
  
    it('should handle errors when retrieving chat messages', async () => {
      zepClientMock.getMemory.mockRejectedValueOnce(new NotFoundError('Session not found'));
  
      const messages = await zepChatHistory.getMessages();
  
      expect(zepClientMock.getMemory).toHaveBeenCalledWith(sessionID);
      expect(messages).toEqual([]);
    });
  });
  
  
    it('should handle errors when retrieving chat messages', async () => {
        zepClientMock.getMemory.mockRejectedValueOnce(new NotFoundError('Session not found'));

        const messages = await zepChatHistory.getMessages();

        expect(zepClientMock.getMemory).toHaveBeenCalledWith(sessionID);
        expect(messages).toEqual([]);
    });
 
  
  describe('search', () => {
    it('should search for chat messages in Zep memory', async () => {
      const query = 'Hello';
      const limit = 10;
      const searchResults: SearchResult[] = [];

      zepClientMock.searchMemory.mockResolvedValueOnce(searchResults);

      const results = await zepChatHistory.search(query, limit);

      expect(zepClientMock.searchMemory).toHaveBeenCalledWith(sessionID, expect.any(Object), limit);
      expect(results.length).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear the Zep memory for the current session', async () => {
      await zepChatHistory.clear();

      expect(zepClientMock.deleteMemory).toHaveBeenCalledWith(sessionID);
    });

    it('should handle errors when clearing the Zep memory', async () => {
      zepClientMock.deleteMemory.mockRejectedValueOnce(new NotFoundError('Session not found'));

      await expect(zepChatHistory.clear()).rejects.toThrowError(NotFoundError);
      expect(zepClientMock.deleteMemory).toHaveBeenCalledWith(sessionID);
    });
  });
});

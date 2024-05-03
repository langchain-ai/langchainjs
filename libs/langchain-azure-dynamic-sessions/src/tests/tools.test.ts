import { test, jest, describe, beforeEach } from "@jest/globals";
import { DefaultAzureCredential } from "@azure/identity";
import { SessionsPythonREPLTool } from "../index.js";

describe("SessionsPythonREPLTool", () => {
  describe("Default access token provider", () => {
    let defaultAccessTokenProvider: () => Promise<string>;
    let getTokenMock: jest.SpiedFunction<DefaultAzureCredential["getToken"]>
    ;
    beforeEach(() => {
      const tool = new SessionsPythonREPLTool({
        poolManagementEndpoint: "https://poolmanagement.com",
        sessionId: "session-id",
      });
      defaultAccessTokenProvider = tool.accessTokenProvider;
      getTokenMock = jest.spyOn(DefaultAzureCredential.prototype, "getToken");
      getTokenMock.mockClear();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    test("Should use cached token when not expiring", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01 10:00:00"));
      getTokenMock.mockImplementationOnce(async () => {
        return {
          token: "test-token",
          expiresOnTimestamp: new Date("2024-01-01 11:00:00").getTime()
        };
      });

      let token = await defaultAccessTokenProvider();
      expect(token).toBe("test-token");
      expect(getTokenMock).toHaveBeenCalledTimes(1);
      expect(getTokenMock).toHaveBeenCalledWith("https://acasessions.io/.default");

      getTokenMock.mockImplementationOnce(async () => {
        return {
          token: "test-token2",
          expiresOnTimestamp: new Date("2024-01-01 11:00:00").getTime()
        };
      });
      
      token = await defaultAccessTokenProvider();
      expect(token).toBe("test-token");
      expect (getTokenMock).toHaveBeenCalledTimes(1);
    });

    test("Should refresh token when expired", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01 10:00:00"));
      getTokenMock.mockImplementationOnce(async () => {
        return {
          token: "test-token1",
          expiresOnTimestamp: new Date("2024-01-01 10:30:00").getTime()
        };
      });

      let token = await defaultAccessTokenProvider();
      expect(token).toBe("test-token1");
      expect (getTokenMock).toHaveBeenCalledTimes(1);

      jest.setSystemTime(new Date("2024-01-01 10:31:00"));
      getTokenMock.mockImplementationOnce(async () => {
        return {
          token: "test-token2",
          expiresOnTimestamp: new Date("2024-01-01 11:00:00").getTime()
        };
      });
      
      token = await defaultAccessTokenProvider();
      expect(token).toBe("test-token2");
      expect (getTokenMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Invoke with Python code", () => {
    test("Should return correct output", async () => {
      const tool = new SessionsPythonREPLTool({
        poolManagementEndpoint: "https://acasessions.io/subscriptions/subscription-id/resourceGroups/resource-group/sessionPools/session-pool/",
        sessionId: "session-id",
      });

      const getTokenMock = jest.spyOn(DefaultAzureCredential.prototype, "getToken");
      getTokenMock.mockResolvedValue({
        token: "test-token",
        expiresOnTimestamp: new Date().getTime() + 1000 * 60 * 60,
      });

      const fetchMock = jest.spyOn(global, "fetch");
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          result: "2",
          stdout: "hello\n",
          stderr: "",
        }),
      } as Response);

      const output = await tool.invoke("print('hello')\n1+1");
      expect(output).toBe("Result:\n2\n\nStdout:\nhello\n\n\nStderr:\n");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("https://acasessions.io/subscriptions/subscription-id/resourceGroups/resource-group/sessionPools/session-pool/python/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify({
          properties: {
            identifier: "session-id",
            codeInputType: "inline",
            executionType: "synchronous",
            pythonCode: "print('hello')\n1+1",
          }
        }),
      });
    });
  });
});

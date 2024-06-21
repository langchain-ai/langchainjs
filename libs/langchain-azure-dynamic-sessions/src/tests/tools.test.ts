import { test, jest, describe, beforeEach } from "@jest/globals";
import { DefaultAzureCredential } from "@azure/identity";
import { SessionsPythonREPLTool } from "../index.js";

describe("SessionsPythonREPLTool", () => {
  describe("Default access token provider", () => {
    let defaultAzureADTokenProvider: () => Promise<string>;
    let getTokenMock: jest.SpiedFunction<DefaultAzureCredential["getToken"]>;
    beforeEach(() => {
      const tool = new SessionsPythonREPLTool({
        poolManagementEndpoint: "https://poolmanagement.com",
        sessionId: "session-id",
      });
      defaultAzureADTokenProvider = tool.azureADTokenProvider;
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
      getTokenMock.mockImplementationOnce(async () => ({
        token: "test-token",
        expiresOnTimestamp: new Date("2024-01-01 11:00:00").getTime(),
      }));

      let token = await defaultAzureADTokenProvider();
      expect(token).toBe("test-token");
      expect(getTokenMock).toHaveBeenCalledTimes(1);
      expect(getTokenMock.mock.calls[0][0]).toEqual([
        "https://acasessions.io/.default",
      ]);

      getTokenMock.mockImplementationOnce(async () => ({
        token: "test-token2",
        expiresOnTimestamp: new Date("2024-01-01 11:00:00").getTime(),
      }));

      token = await defaultAzureADTokenProvider();
      expect(token).toBe("test-token");
      expect(getTokenMock).toHaveBeenCalledTimes(1);
    });

    test("Should refresh token when expired", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01 10:00:00"));
      getTokenMock.mockImplementationOnce(async () => ({
        token: "test-token1",
        expiresOnTimestamp: new Date("2024-01-01 10:30:00").getTime(),
      }));

      let token = await defaultAzureADTokenProvider();
      expect(token).toBe("test-token1");
      expect(getTokenMock).toHaveBeenCalledTimes(1);

      jest.setSystemTime(new Date("2024-01-01 10:31:00"));
      getTokenMock.mockImplementationOnce(async () => ({
        token: "test-token2",
        expiresOnTimestamp: new Date("2024-01-01 11:00:00").getTime(),
      }));

      token = await defaultAzureADTokenProvider();
      expect(token).toBe("test-token2");
      expect(getTokenMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Invoke with Python code", () => {
    test("Should return correct output", async () => {
      const tool = new SessionsPythonREPLTool({
        poolManagementEndpoint:
          "https://acasessions.io/subscriptions/subscription-id/resourceGroups/resource-group/sessionPools/session-pool/",
        sessionId: "session-id",
      });

      const getTokenMock = jest.spyOn(
        DefaultAzureCredential.prototype,
        "getToken"
      );
      getTokenMock.mockResolvedValue({
        token: "test-token",
        expiresOnTimestamp: new Date().getTime() + 1000 * 60 * 60,
      });

      const fetchMock = jest.spyOn(global, "fetch");
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          $id: "1",
          properties: {
            $id: "2",
            status: "Success",
            stdout: "hello\n",
            stderr: "",
            result: 2,
            executionTimeInMilliseconds: 35,
          },
        }),
      } as Response);

      const output = await tool.invoke("print('hello')\n1+1");
      expect(JSON.parse(output)).toStrictEqual({
        stdout: "hello\n",
        stderr: "",
        result: 2,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://acasessions.io/subscriptions/subscription-id/resourceGroups/resource-group/sessionPools/session-pool/code/execute?identifier=session-id&api-version=2024-02-02-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
            "User-Agent": expect.stringMatching(
              /^langchainjs-azure-dynamic-sessions\s@langchain\/azure-dynamic-sessions\/\d+\.\d+\.\d+ \(Language=JavaScript.*\)$/
            ),
          },
          body: JSON.stringify({
            properties: {
              codeInputType: "inline",
              executionType: "synchronous",
              code: "print('hello')\n1+1",
            },
          }),
        }
      );
    });
  });
});

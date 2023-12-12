import {
  AuthFlowToken,
  OutlookReadMailTool,
  OutlookSendMailTool,
} from "../outlook/index.js";

describe.skip("OutlookReadMailTool Test", () => {
  test("Test invalid access token", async () => {
    const accessToken = "blah";
    const authFlow = new AuthFlowToken(accessToken);
    const outlookTool = new OutlookReadMailTool(authFlow);
    const emails = await outlookTool.call("");
    expect(emails).toBe("Fetch mail error: 401");
  });

  test("Test read messages", async () => {
    const outlookTool = new OutlookReadMailTool(undefined, "refresh");
    const emails = await outlookTool.call("");
    expect(emails.substring(0, 7)).toBe("subject");
  });

  test("Test invalid query format", async () => {
    const outlookTool = new OutlookReadMailTool(undefined, "refresh");
    const emails = await outlookTool.call("blah");
    expect(emails).toBe("Invalid query format");
  });

  test("Test query correct format", async () => {
    const outlookTool = new OutlookReadMailTool(undefined, "refresh");
    const emails = await outlookTool.call('$search="subject:hello"');
    expect(emails.substring(0, 7)).toBe("subject");
  });
});

describe.skip("OutlookSendMailTool Test", () => {
  test("Test invalid TO email address", async () => {
    const message = JSON.stringify({
      subject: "test",
      content: "test",
      to: ["testemail"],
      cc: [],
    });
    const outlookTool = new OutlookSendMailTool(undefined, "refresh");
    const res = await outlookTool.call(message);
    expect(res).toBe("TO must be an array of valid email in strings");
  });

  test("Test invalid CC email address", async () => {
    const message = JSON.stringify({
      subject: "test",
      content: "test",
      to: ["test@email.com"],
      cc: ["blah"],
    });
    const outlookTool = new OutlookSendMailTool(undefined, "refresh");
    const res = await outlookTool.call(message);
    expect(res).toBe("CC must be an array of valid email in strings");
  });

  test("Test invalid JSON format", async () => {
    const message = "blah";
    const outlookTool = new OutlookSendMailTool(undefined, "refresh");
    const res = await outlookTool.call(message);
    expect(res).toBe("Invalid JSON format");
  });

  test("Test valid email address", async () => {
    const message = JSON.stringify({
      subject: "test",
      content: "test",
      to: ["test@email.com"],
      cc: [],
    });
    const outlookTool = new OutlookSendMailTool(undefined, "refresh");
    const res = await outlookTool.call(message);
    expect(res).toBe("Email sent");
  });
});

import {
  AuthFlowToken,
  OutlookReadMailTool,
  OutlookSendMailTool,
} from "../outlook/index.js";

describe("OutlookReadMailTool Test", () => {
  test("Test invalid access token", async () => {
    const accessToken = "blah";
    const authFlow = new AuthFlowToken(accessToken);
    const outlookTool = new OutlookReadMailTool(authFlow);
    const emails = await outlookTool.call("");
    expect(emails).toBe("Fetch mail error: 401");
  });

  test("Test read messages", async () => {
    const outlookTool = new OutlookReadMailTool(undefined, "refresh");
    const emails = await outlookTool._call("");
    console.log(emails);
    expect(true).toBe(true);
  });

  test("Test invalid query format", async () => {
    const outlookTool = new OutlookReadMailTool(undefined, "refresh");
    const emails = await outlookTool._call("blah");
    console.log(emails);
    expect(emails).toBe("Invalid query format");
  });

  test("Test query correct format", async () => {
    const outlookTool = new OutlookReadMailTool(undefined, "refresh");
    const emails = await outlookTool._call('$search="subject:hello"');
    console.log(emails);
    expect(true).toBe(true);
  });
});

describe("OutlookSendMailTool Test", () => {
  test("Test invalid TO email address", async () => {
    const message = JSON.stringify({
      subject: "test",
      content: "test",
      to: ["testemail"],
      cc: [],
    });
    const outlookTool = new OutlookSendMailTool(undefined, "refresh");
    const res = await outlookTool._call(message);
    console.log(res);
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
    const res = await outlookTool._call(message);
    console.log(res);
    expect(res).toBe("CC must be an array of valid email in strings");
  });

  test("Test invalid JSON format", async () => {
    const message = "blah";
    const outlookTool = new OutlookSendMailTool(undefined, "refresh");
    const res = await outlookTool._call(message);
    console.log(res);
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
    const res = await outlookTool._call(message);
    console.log(res);
    expect(res).toBe("Email sent");
  });
});

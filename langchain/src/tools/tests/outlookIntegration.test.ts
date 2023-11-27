import { OutlookIntegration } from '../outlookIntegration.js';

const toolParams = {};

const outlookTool = new OutlookIntegration(toolParams);

describe("outlook integration test suite", () => {
  test("Test get token", async () => {
    const token = await outlookTool.getToken();
    console.log(token);
    expect(token).toBeDefined();
  });

  test("Test read me", async () => {
    const email = await outlookTool.readme();
    console.log(email);
    expect(email).toBeDefined();
  });

  test("Test read emails", async () => {
    const emails = await outlookTool.readEmails();
    expect(emails).toBeDefined();
  });
});
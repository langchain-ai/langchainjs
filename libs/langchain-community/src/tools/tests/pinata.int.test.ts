import { expect, describe, test, beforeAll } from "@jest/globals";
import {
  PinataCreateGroupTool,
  PinataDeleteGroupTool,
  PinataGetGroupTool,
  PinataListGroupTool,
  PinataUpdateGroupTool,
} from "../pinata/group.js";

// Shared group ID across tests
let testGroupId: string;
const originalName = "Example Group";
const updatedName = "Latest Example Group";

// Shared config
const config = {
  pinataJwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxMzEyNTcyYy04MTVmLTQ2ZmEtOWI0ZC1mZjE2NmNlYzU1M2MiLCJlbWFpbCI6Imphc21pbmVodWV5LndlYjNAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImQ0N2IxNTA4MTk3MzZlMzc2NTY2Iiwic2NvcGVkS2V5U2VjcmV0IjoiNTM4N2YzOGFjYzU3MGRjNTgyZGRjYmUyYjQzMDNhNTUyNTc1NzI0YjgwMmE2MDdmMWFiNDdhNTVlMjQ4ZGM0YyIsImV4cCI6MTc3NjYwMjcxOX0.Tw6zVhDbJj1dOAjs4a_le76oUuWiPpIrQCUDk7uzJ9A",
  pinataGateway: "chocolate-magnetic-scorpion-427.mypinata.cloud",
};

// Expected response types
type GroupResponseItem = {
  id: string;
  name: string;
  created_at: string;
};

type GroupListResponse = {
  groups: GroupResponseItem[];
  next_page_token: string;
};

describe("Pinata Group Management Integration", () => {
  let createTool: PinataCreateGroupTool;
  let getTool: PinataGetGroupTool;
  let updateTool: PinataUpdateGroupTool;
  let listTool: PinataListGroupTool;
  let deleteTool: PinataDeleteGroupTool;

  beforeAll(() => {
    createTool = new PinataCreateGroupTool(config);
    getTool = new PinataGetGroupTool(config);
    updateTool = new PinataUpdateGroupTool(config);
    listTool = new PinataListGroupTool(config);
    deleteTool = new PinataDeleteGroupTool(config);
  });

  test("should create a group named - Example Group successfully", async () => {
    const result = await createTool.invoke({ name: originalName });
    const parsed: GroupResponseItem = JSON.parse(result);

    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("name", originalName);
    expect(parsed).toHaveProperty("created_at");

    testGroupId = parsed.id;
  });

  test("should retrieve the created group by ID", async () => {
    const result = await getTool.invoke({ groupId: testGroupId });
    const parsed: GroupResponseItem = JSON.parse(result);

    expect(parsed).toHaveProperty("id", testGroupId);
    expect(parsed).toHaveProperty("name", originalName);
    expect(parsed).toHaveProperty("created_at");
  });

  test("should update the group name to Latest Example Group successfully", async () => {
    const result = await updateTool.invoke({
      groupId: testGroupId,
      name: updatedName,
    });
    const parsed: GroupResponseItem = JSON.parse(result);

    expect(parsed).toHaveProperty("id", testGroupId);
    expect(parsed).toHaveProperty("name", updatedName);
    expect(parsed).toHaveProperty("created_at");
  });

  test("should list the group with the updated name - Latest Example Group", async () => {
    const result = await listTool.invoke({
      name: updatedName,
      limit: 1,
    });
    const parsed: GroupListResponse = JSON.parse(result);
  
    expect(parsed).toHaveProperty("groups");
    expect(Array.isArray(parsed.groups)).toBe(true);
    expect(parsed.groups.length).toBeGreaterThan(0);
  
    const found = parsed.groups.find((g) => g.name === updatedName);
    
    // Check if the group was found or handle it gracefully
    expect(found).not.toBeUndefined(); // Ensure that the group is found
    if (found) {
      expect(found.name).toBe(updatedName);
      expect(found).toHaveProperty("id");
      expect(found).toHaveProperty("created_at");
    }
  });
});


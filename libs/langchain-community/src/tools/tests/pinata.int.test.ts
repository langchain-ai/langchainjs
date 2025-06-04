import { expect, describe, test, beforeAll } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { PinataUploadFileTool } from "../pinata/upload.js";
import { PinataQueryFileTool } from "../pinata/query.js";
import { PinataDeleteFileTool } from "../pinata/delete.js";
import {
  PinataCreateGroupTool,
  PinataDeleteGroupTool,
  PinataGetGroupTool,
  PinataListGroupTool,
  PinataUpdateGroupTool,
} from "../pinata/group.js";

//Mock values for testing
let testGroupId: string;
const originalName = "Example Group";
const updatedName = "Latest Example Group";
let uploadedFileId: string;
let uploadedFileCid: string;
let uploadedFileMimeType: string;
const uploadedFileName = "Astronaut Emoji";
const fileTag = "emoji";
const url =
  "https://em-content.zobj.net/source/apple/391/astronaut-light-skin-tone_1f9d1-1f3fb-200d-1f680.png";
let uploadedFileSize: number;
let uploadedFileCount: number;

// Shared config
const config = {
  pinataJwt: getEnvironmentVariable("PINATA_JWT"),
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

type FileQueryItem = {
  id: string;
  name: string;
  cid: string;
  size: number;
  number_of_files: number;
  mime_type: string;
  group_id: string | null;
  created_at: string;
};

// Test
describe("Pinata Integration Test", () => {
  let createTool: PinataCreateGroupTool;
  let getTool: PinataGetGroupTool;
  let updateTool: PinataUpdateGroupTool;
  let listTool: PinataListGroupTool;
  let deleteGroupTool: PinataDeleteGroupTool;
  let uploadTool: PinataUploadFileTool;
  let queryTool: PinataQueryFileTool;
  let deleteFileTool: PinataDeleteFileTool;

  beforeAll(() => {
    createTool = new PinataCreateGroupTool(config);
    getTool = new PinataGetGroupTool(config);
    updateTool = new PinataUpdateGroupTool(config);
    listTool = new PinataListGroupTool(config);
    deleteGroupTool = new PinataDeleteGroupTool(config);
    uploadTool = new PinataUploadFileTool(config);
    queryTool = new PinataQueryFileTool(config);
    deleteFileTool = new PinataDeleteFileTool(config);
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

    expect(found).not.toBeUndefined();
    if (found) {
      expect(found.name).toBe(updatedName);
      expect(found).toHaveProperty("id");
      expect(found).toHaveProperty("created_at");
    }
  });

  test("should upload a file (Astronaut Emoji) successfully to the group", async () => {
    const uploadParams = {
      url: url,
      group: testGroupId,
      name: uploadedFileName,
      keyvalues: { tag: fileTag },
    };

    const uploadResult = await uploadTool.invoke(uploadParams);
    const uploaded = JSON.parse(uploadResult);

    expect(uploaded).toHaveProperty("id");
    expect(uploaded).toHaveProperty("cid");
    expect(uploaded).toHaveProperty("name", uploadedFileName);
    expect(uploaded).toHaveProperty("mime_type");
    expect(uploaded).toHaveProperty("size");
    expect(uploaded).toHaveProperty("number_of_files");

    uploadedFileId = uploaded.id;
    uploadedFileCid = uploaded.cid;
    uploadedFileMimeType = uploaded.mime_type;
    uploadedFileSize = uploaded.size;
    uploadedFileCount = uploaded.number_of_files;
  });

  test("should query and return the uploaded file (Astronaut Emoji) with the same parameters", async () => {
    const queryParams = {
      name: uploadedFileName,
      group: testGroupId,
      cid: uploadedFileCid,
      mimeType: uploadedFileMimeType,
      keyvalues: { tag: fileTag },
      order: "ASC",
      limit: 1,
      cidPending: false,
    };

    const queryResult = await queryTool.invoke(queryParams);
    const parsed = JSON.parse(queryResult);

    expect(parsed).toHaveProperty("files");
    expect(Array.isArray(parsed.files)).toBe(true);
    expect(parsed.files.length).toBeGreaterThan(0);

    const match = parsed.files.find(
      (f: FileQueryItem) => f.cid === uploadedFileCid
    );
    expect(match).toBeDefined();
    if (match) {
      expect(match.id).toBe(uploadedFileId);
      expect(match.name).toBe(uploadedFileName);
      expect(match.group_id).toBe(testGroupId);
      expect(match.mime_type).toBe(uploadedFileMimeType);
      expect(match.size).toBe(uploadedFileSize);
      expect(match.number_of_files).toBe(uploadedFileCount);
      expect(match).toHaveProperty("created_at");
    }
  });

  test("should delete the uploaded file (cleanup)", async () => {
    const deleteResult = await deleteFileTool.invoke({
      files: [uploadedFileId],
    });
    const deleted: { id: string; status: string }[] = JSON.parse(deleteResult);

    expect(Array.isArray(deleted)).toBe(true);
    expect(deleted.length).toBe(1);
    expect(deleted[0].id).toBe(uploadedFileId);
    expect(deleted[0]).toHaveProperty("status");
  });

  test("should delete the group created (cleanup)", async () => {
    const result = await deleteGroupTool.invoke({ groupId: testGroupId });
    expect(JSON.parse(result)).toBe("OK");
  });
});

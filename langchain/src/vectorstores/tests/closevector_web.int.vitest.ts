/**
 * @vitest-environment happy-dom
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from "vitest";
import { createPublicGetFileOperationUrl, fetchUsingToken, END_POINT } from "closevector-web";
import { CloseVectorWeb } from "../closevector_web.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { getEnvironmentVariable } from "../../util/env.js";

// eslint-disable-next-line import/no-extraneous-dependencies
import "fake-indexeddb/auto";

describe("Test CloseVectorNode", async () => {
  it("Test HNSWLib.fromTexts + addVectors", async () => {

    const key = getEnvironmentVariable("CLOSEVECTOR_API_KEY");
    const secret = getEnvironmentVariable("CLOSEVECTOR_API_SECRET");

    if (!key || !secret) {
      throw new Error("CLOSEVECTOR_API_KEY or CLOSEVECTOR_API_SECRET not set");
    }

    async function createUploadFileOperationUrl(key: string, secret: string) {
      const resp = await fetchUsingToken(`${END_POINT}/file/url`, {
        accessKey: key, secret,
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          description: "test",
          visibility: 0 // public
        })
      });
      
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(`${resp.status}: ${json.message || 'Unknown error'}`);
      }

      const { url, uuid } = json;
      return { url, uuid };
    }

    const vectorStore = await CloseVectorWeb.fromTexts(
      ["Hello world"],
      [{ id: 2 }],
      new OpenAIEmbeddings(),
      undefined,
      {
        key,
        secret
      }
    );
    expect(vectorStore.instance.index?.getMaxElements()).toBe(1);
    expect(vectorStore.instance.index?.getCurrentCount()).toBe(1);

    let resp = await createUploadFileOperationUrl(key, secret);

    await vectorStore.saveToCloud({
      url: resp.url,
      uuid: resp.uuid
    })

    resp = await createPublicGetFileOperationUrl({
      uuid: resp.uuid,
      accessKey: key
    });

    const vectorStore2 = await CloseVectorWeb.loadFromCloud({
      url: resp.url,
      uuid: resp.uuid,
      embeddings: new OpenAIEmbeddings()
    });

    expect(vectorStore2.instance.index?.getMaxElements()).toBe(1);
  });

});

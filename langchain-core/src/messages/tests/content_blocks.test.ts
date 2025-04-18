import { describe, it, expect } from "@jest/globals";
import {
  isDataContentBlock,
  convertToOpenAIImageBlock,
} from "../content_blocks.js";

/**
 * 
 * def test_is_data_content_block() -> None:
    assert is_data_content_block(
        {
            "type": "image",
            "source_type": "url",
            "url": "https://...",
        }
    )
    assert is_data_content_block(
        {
            "type": "image",
            "source_type": "base64",
            "data": "<base64 data>",
            "mime_type": "image/jpeg",
        }
    )
    assert is_data_content_block(
        {
            "type": "image",
            "source_type": "base64",
            "data": "<base64 data>",
            "mime_type": "image/jpeg",
            "metadata": {"cache_control": {"type": "ephemeral"}},
        }
    )

    assert not is_data_content_block(
        {
            "type": "text",
            "text": "foo",
        }
    )
    assert not is_data_content_block(
        {
            "type": "image_url",
            "image_url": {"url": "https://..."},
        }
    )
    assert not is_data_content_block(
        {
            "type": "image",
            "source_type": "base64",
        }
    )
    assert not is_data_content_block(
        {
            "type": "image",
            "source": "<base64 data>",
        }
    )


def test_convert_to_openai_image_block() -> None:
    input_block = {
        "type": "image",
        "source_type": "url",
        "url": "https://...",
        "metadata": {"cache_control": {"type": "ephemeral"}},
    }
    expected = {
        "type": "image_url",
        "image_url": {"url": "https://..."},
    }
    result = convert_to_openai_image_block(input_block)
    assert result == expected

    input_block = {
        "type": "image",
        "source_type": "base64",
        "data": "<base64 data>",
        "mime_type": "image/jpeg",
        "metadata": {"cache_control": {"type": "ephemeral"}},
    }
    expected = {
        "type": "image_url",
        "image_url": {
            "url": "data:image/jpeg;base64,<base64 data>",
        },
    }
    result = convert_to_openai_image_block(input_block)
    assert result == expected
 */

describe("isDataContentBlock", () => {
  it("should return true for valid DataContentBlock objects", () => {
    expect(
      isDataContentBlock({
        type: "image",
        source_type: "url",
        url: "https://...",
      })
    ).toBe(true);

    expect(
      isDataContentBlock({
        type: "image",
        source_type: "base64",
        data: "<base64 data>",
        mime_type: "image/jpeg",
      })
    ).toBe(true);

    expect(
      isDataContentBlock({
        type: "image",
        source_type: "base64",
        data: "<base64 data>",
        mime_type: "image/jpeg",
        metadata: { cache_control: { type: "ephemeral" } },
      })
    ).toBe(true);
  });
  it("should return false for invalid DataContentBlock objects", () => {
    expect(
      isDataContentBlock({
        type: "text",
        text: "foo",
      })
    ).toBe(false);

    expect(
      isDataContentBlock({
        type: "image_url",
        image_url: { url: "https://..." },
      })
    ).toBe(false);

    expect(
      isDataContentBlock({
        type: "image",
        source: "<base64 data>",
      })
    ).toBe(false);
  });
});

describe("convertToOpenAIImageBlock", () => {
  it("should convert a valid DataContentBlock to OpenAI image block", () => {
    const inputBlock = {
      type: "image",
      source_type: "url",
      url: "https://...",
      metadata: { cache_control: { type: "ephemeral" } },
    };
    const expected = {
      type: "image_url",
      image_url: { url: "https://..." },
    };
    const result = convertToOpenAIImageBlock(inputBlock);
    expect(result).toEqual(expected);

    const inputBlock2 = {
      type: "image",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "image/jpeg",
      metadata: { cache_control: { type: "ephemeral" } },
    };
    const expected2 = {
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,<base64 data>",
      },
    };
    const result2 = convertToOpenAIImageBlock(inputBlock2);
    expect(result2).toEqual(expected2);
  });
});

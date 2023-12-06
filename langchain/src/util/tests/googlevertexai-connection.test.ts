import { expect, test } from "@jest/globals";
import {
  simpleValue,
  complexValue,
  GoogleVertexAIStream,
} from "../googlevertexai-connection.js";

describe("VertexAI Connection", () => {
  describe("complexValue", () => {
    test("int_val", () => {
      const result = complexValue(1);
      expect(result).toEqual({ int_val: 1 });
    });

    test("float_val", () => {
      const result = complexValue(2.5);
      expect(result).toEqual({ float_val: 2.5 });
    });

    test("string_val", () => {
      const result = complexValue("hello");
      expect(result).toEqual({ string_val: ["hello"] });
    });

    test("list_val", () => {
      const input = [1, 2.5, "three"];
      const result = complexValue(input);
      expect(result).toEqual({
        list_val: [
          { int_val: 1 },
          { float_val: 2.5 },
          { string_val: ["three"] },
        ],
      });
    });

    test("struct_val", () => {
      const input = {
        content: "prompt",
        author: "the author",
      };
      const result = complexValue(input);
      expect(result).toEqual({
        struct_val: {
          content: { string_val: ["prompt"] },
          author: { string_val: ["the author"] },
        },
      });
    });
  });

  describe("simpleValue", () => {
    test("boolVal true", () => {
      const input = {
        boolVal: [true],
      };
      const result = simpleValue(input);
      expect(result).toEqual(true);
    });

    test("boolVal false", () => {
      const input = {
        boolVal: [false],
      };
      const result = simpleValue(input);
      expect(result).toEqual(false);
    });

    test("stringVal", () => {
      const input = {
        stringVal: ["they will suffer"],
      };
      const result = simpleValue(input);
      expect(result).toEqual("they will suffer");
    });

    test("structVal", () => {
      const input = {
        structVal: {
          citationMetadata: {
            structVal: {
              citations: {},
            },
          },
          safetyAttributes: {
            structVal: {
              categories: {},
              scores: {},
              blocked: {
                boolVal: [false],
              },
            },
          },
          content: {
            stringVal: ["RESPONSE"],
          },
        },
      };
      const result = simpleValue(input);
      expect(result).toEqual({
        citationMetadata: {
          citations: {},
        },
        safetyAttributes: {
          categories: {},
          scores: {},
          blocked: false,
        },
        content: "RESPONSE",
      });
    });
  });

  describe("GoogleVertexAIStream", () => {
    test("skipToOpenBracket", () => {
      const gen = new GoogleVertexAIStream();
      gen._buffer = '[{"hi": "there"}]';
      gen._skipTo("{");
      expect(gen._buffer).toEqual('{"hi": "there"}]');
    });

    test("getFullObject", () => {
      const gen = new GoogleVertexAIStream();
      gen._buffer = '[{"hi": "there"}]';
      gen._skipTo("{");
      const obj = gen._getFullObject();
      expect(obj).toEqual({ hi: "there" });
      expect(gen._buffer).toEqual("]");
    });

    test("getFullObject incomplete", () => {
      const gen = new GoogleVertexAIStream();
      gen._buffer = '[{"hi": "ther';
      gen._skipTo("{");
      const obj = gen._getFullObject();
      expect(obj).toEqual(null);
      expect(gen._buffer).toEqual('{"hi": "ther');
    });

    test("getFullObject strings", () => {
      const gen = new GoogleVertexAIStream();
      gen._buffer = '[{"frown": "}:"}]';
      gen._skipTo("{");
      const obj = gen._getFullObject();
      expect(obj).toEqual({ frown: "}:" });
      expect(gen._buffer).toEqual("]");
    });

    test("getFullObject complex", () => {
      const gen = new GoogleVertexAIStream();
      gen._buffer = JSON.stringify(
        [
          {
            alpha: {
              uno: 1,
              dos: 2,
            },
            bravo: {
              here: 3,
              there: 4,
            },
          },
        ],
        null,
        2
      );
      gen._skipTo("{");
      const obj = gen._getFullObject();
      expect(obj).toEqual({
        alpha: {
          uno: 1,
          dos: 2,
        },
        bravo: {
          here: 3,
          there: 4,
        },
      });
      expect(gen._buffer).toEqual("\n]");
    });

    test("getFullObject bufered", () => {
      const gen = new GoogleVertexAIStream();
      const overall = JSON.stringify(
        [
          {
            alpha: {
              uno: 1,
              dos: 2,
            },
            bravo: {
              here: 3,
              there: 4,
            },
          },
        ],
        null,
        2
      );
      const part1 = overall.substring(0, overall.length / 2);
      const part2 = overall.substring(overall.length / 2);

      gen._buffer += part1;
      gen._skipTo("{");
      const obj1 = gen._getFullObject();
      expect(obj1).toEqual(null);

      gen._buffer += part2;
      gen._skipTo("{");
      const obj2 = gen._getFullObject();
      expect(obj2).toEqual({
        alpha: {
          uno: 1,
          dos: 2,
        },
        bravo: {
          here: 3,
          there: 4,
        },
      });
      expect(gen._buffer).toEqual("\n]");
    });

    test("end-to-end", async () => {
      const src = [
        `[{
  "outputs": [
    {
      "structVal": {
        "safetyAttributes": {
          "structVal": {
            "scores": {
              "listVal": [
                {
                  "doubleVal": [
                    0.5
                  ]
                }
              ]
            },
            "categories": {
              "listVal": [
                {
                  "stringVal": [
                    "Religion & Belief"
                  ]
                }
              ]
            },
            "blocked": {
              "boolVal": [
                false
              ]
            }
          }
        },
        "content": {
          "stringVal": [
            " The answer to life, the universe, and everything is 42. This an"
          ]
        },
        "citationMetadata": {
          "structVal": {
            "citations": {}
          }
        }
      }
    }
  ]
},
`,
        `{
  "outputs": [
    {
      "structVal": {
        "citationMetadata": {
          "structVal": {
            "citations": {}
          }
        },
        "safetyAttributes": {
          "structVal": {
            "categories": {
              "listVal": [
                {
                  "stringVal": [
                    "Religion & Belief"
                  ]
                }
              ]
            },
            "blocked": {
              "boolVal": [
                false
              ]
            },
            "scores": {
              "listVal": [
                {
                  "doubleVal": [
                    0.3
                  ]
                }
              ]
            }
          }
        },
        "content": {
          "stringVal": [
            "swer was given by Deep Thought, a supercomputer in Douglas Adams"
          ]
        }
      }
    }
  ]
}
`,
        `,{
  "outputs": [
    {
      "structVal": {
        "citationMetadata": {
          "structVal": {
            "citations": {}
          }
        },
        "`,
        `content": {
"stringVal": [
  "`,
        `'`,
        `s`,
        ` The `,
        `H`,
        `i`,
        `tchhiker's Guide to the Galaxy."
]
      },
      "safetyAttributes": {
        "structVal": {
          "blocked": {
            "boolVal": [
              false
            ]
          },
          "categories": {
            "listVal": [
              {
                "stringVal": [
                  "Religion & Belief"
                ]
              }
            ]
          },
          "scores": {
            "listVal": [
              {
                "doubleVal": [
                  0.5
                ]
              }
            ]
          }
        }
      }
    }
  }
  ]
}
`,
        `]`,
      ];
      const gen = new GoogleVertexAIStream();

      // Set future events to append things to the buffer
      let co = 0;
      for (let i = 0; i < src.length; i += 1) {
        co += 1;
        setTimeout(() => {
          gen.appendBuffer(src[i]);
        }, co * 250);
      }
      co += 1;
      setTimeout(() => {
        gen.closeBuffer();
      }, co * 250);

      const chunks = [];
      while (!gen.streamDone) {
        const chunk = await gen.nextChunk();
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(4);
      expect(chunks[0]?.outputs[0]?.content).toBe(
        " The answer to life, the universe, and everything is 42. This an"
      );
      expect(chunks[1]?.outputs[0]?.content).toBe(
        "swer was given by Deep Thought, a supercomputer in Douglas Adams"
      );
      expect(chunks[2]?.outputs[0]?.content).toBe(
        "'s The Hitchhiker's Guide to the Galaxy."
      );
      expect(chunks[3]).toBeNull();
    });
  });
});

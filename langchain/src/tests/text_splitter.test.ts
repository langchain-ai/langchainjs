import { test, expect } from "@jest/globals";
import { Document } from "../document.js";
import {
  CharacterTextSplitter,
  GenericCodeSplitter,
  JavascriptClassTextSplitter,
  JavascriptFunctionTextSplitter,
  JavascriptTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "../text_splitter.js";

test("Test splitting by character count.", async () => {
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 7,
    chunkOverlap: 3,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo bar", "bar baz", "baz 123"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count doesn't create empty documents.", async () => {
  const text = "foo  bar";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 2,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo", "bar"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count on long words.", async () => {
  const text = "foo bar baz a a";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 1,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo", "bar", "baz", "a a"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count when shorter words are first.", async () => {
  const text = "a a foo bar baz";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 1,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["a a", "foo", "bar", "baz"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by characters when splits not found easily.", async () => {
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 1,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo", "bar", "baz", "123"];
  expect(output).toEqual(expectedOutput);
});

test("Test invalid arguments.", () => {
  expect(() => {
    const res = new CharacterTextSplitter({ chunkSize: 2, chunkOverlap: 4 });
    console.log(res);
  }).toThrow();
});

test("Test create documents method.", async () => {
  const texts = ["foo bar", "baz"];
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments(texts);
  const metadata = { loc: { lines: { from: 1, to: 1 } } };
  const expectedDocs = [
    new Document({ pageContent: "foo", metadata }),
    new Document({ pageContent: "bar", metadata }),
    new Document({ pageContent: "baz", metadata }),
  ];
  expect(docs).toEqual(expectedDocs);
});

test("Test create documents with metadata method.", async () => {
  const texts = ["foo bar", "baz"];
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments(texts, [
    { source: "1" },
    { source: "2" },
  ]);
  const loc = { lines: { from: 1, to: 1 } };
  const expectedDocs = [
    new Document({ pageContent: "foo", metadata: { source: "1", loc } }),
    new Document({
      pageContent: "bar",
      metadata: { source: "1", loc },
    }),
    new Document({ pageContent: "baz", metadata: { source: "2", loc } }),
  ];
  expect(docs).toEqual(expectedDocs);
});

test("Test iterative text splitter.", async () => {
  const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.
This is a weird text to write, but gotta test the splittingggg some how.\n\n
Bye!\n\n-H.`;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 1,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = [
    "Hi.",
    "I'm",
    "Harrison.",
    "How? Are?",
    "You?",
    "Okay then f",
    "f f f f.",
    "This is a",
    "a weird",
    "text to",
    "write, but",
    "gotta test",
    "the",
    "splitting",
    "gggg",
    "some how.",
    "Bye!\n\n-H.",
  ];
  expect(output).toEqual(expectedOutput);
});

test("Token text splitter", async () => {
  const text = "foo bar baz a a";
  const splitter = new TokenTextSplitter({
    encodingName: "r50k_base",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo bar b", "az a a"];

  expect(output).toEqual(expectedOutput);
});

test("Test markdown text splitter.", async () => {
  const text =
    "# 🦜️🔗 LangChain\n" +
    "\n" +
    "⚡ Building applications with LLMs through composability ⚡\n" +
    "\n" +
    "## Quick Install\n" +
    "\n" +
    "```bash\n" +
    "# Hopefully this code block isn't split\n" +
    "pip install langchain\n" +
    "```\n" +
    "\n" +
    "As an open source project in a rapidly developing field, we are extremely open to contributions.";
  const splitter = new MarkdownTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = [
    "# 🦜️🔗 LangChain\n\n⚡ Building applications with LLMs through composability ⚡",
    "Quick Install\n\n```bash\n# Hopefully this code block isn't split\npip install langchain",
    "As an open source project in a rapidly developing field, we are extremely open to contributions.",
  ];
  expect(output).toEqual(expectedOutput);
});

test("Test lines loc on iterative text splitter.", async () => {
  const text = `Hi.\nI'm Harrison.\n\nHow?\na\nb`;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 20,
    chunkOverlap: 1,
  });
  const docs = await splitter.createDocuments([text]);

  const expectedDocs = [
    new Document({
      pageContent: "Hi.\nI'm Harrison.",
      metadata: { loc: { lines: { from: 1, to: 2 } } },
    }),
    new Document({
      pageContent: "How?\na\nb",
      metadata: { loc: { lines: { from: 4, to: 6 } } },
    }),
  ];

  expect(docs).toEqual(expectedDocs);
});

test("Test javascript function splitter.", async () => {
  const text = `
  import { test, expect } from "@jest/globals";
  import { Document } from "../document.js";
  import {
    CharacterTextSplitter,
    MarkdownTextSplitter,
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
  } from "../text_splitter.js";

  export interface SomeInterface {
    someParam: string
    someOtherParam: string

    function someMethod(): string
  }

  abstract class SomeAbstractClass {
    abstract function someMethod(): string
  }

  export class SomeRandomClass {
    static someParam
    const someOtherParam
    let aVar = "test"

    // Constructor is wrongly documented, but thats okay
    // A second line
    constructor() {
      this.someParam = "test"
      this.someOtherParam = "anotherTest"
    }

    // A random inline comment

    async function someMethod() {
      return this.someParam
    }

    /* The earlier method was documented, but this one isn't! */
    function anotherMethod() {
      throw new Error("Method not yet implemented.")
    }
  }
  `;

  const splitter = new JavascriptFunctionTextSplitter({
    chunkSize: 1,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments([text]);

  expect(docs.length).toBe(6);
});

test("Test javascript class splitter.", async () => {
  const text = `
  import { test, expect } from "@jest/globals";
  import { Document } from "../document.js";
  import {
    CharacterTextSplitter,
    MarkdownTextSplitter,
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
  } from "../text_splitter.js";

  export interface SomeInterface {
    someParam: string
    someOtherParam: string

    function someMethod(): string
  }

  abstract class SomeAbstractClass {
    abstract function someMethod(): string
  }

  export class SomeRandomClass {
    static someParam
    const someOtherParam
    let aVar = "test"

    // Constructor is wrongly documented, but thats okay
    // A second line
    constructor() {
      this.someParam = "test"
      this.someOtherParam = "anotherTest"
    }

    // A random inline comment

    async function someMethod() {
      return this.someParam
    }

    /* The earlier method was documented, but this one isn't! */
    function anotherMethod() {
      throw new Error("Method not yet implemented.")
    }
  }
  `;

  const splitter = new JavascriptClassTextSplitter({
    chunkSize: 1,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments([text]);

  expect(docs.length).toBe(4);
});

test("Test javascript splitter.", async () => {
  const text = `
  import { test, expect } from "@jest/globals";
  import { Document } from "../document.js";
  import {
    CharacterTextSplitter,
    MarkdownTextSplitter,
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
  } from "../text_splitter.js";

  export interface SomeInterface {
    someParam: string
    someOtherParam: string

    function someMethod(): string
  }

  abstract class SomeAbstractClass {
    abstract function someMethod(): string
  }

  export class SomeRandomClass {
    static someParam
    const someOtherParam
    let aVar = "test"

    // Constructor is wrongly documented, but thats okay
    // A second line
    constructor() {
      this.someParam = "test"
      this.someOtherParam = "anotherTest"
    }

    // A random inline comment

    async function someMethod() {
      return this.someParam
    }

    /* The earlier method was documented, but this one isn't! */
    function anotherMethod() {
      throw new Error("Method not yet implemented.")
    }
  }
  `;

  const splitter = new JavascriptTextSplitter({
    chunkSize: 1,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments([text]);

  expect(docs.length).toBe(9);
});

test("Test generic splitter.", async () => {
  const text = `
  contract Dai is LibNote {
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address guy) external note auth { wards[guy] = 1; }
    function deny(address guy) external note auth { wards[guy] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Dai/not-authorized");
        _;
    }

    // --- ERC20 Data ---
    string  public constant name     = "Dai Stablecoin";
    string  public constant symbol   = "DAI";
    string  public constant version  = "1";
    uint8   public constant decimals = 18;
    uint256 public totalSupply;

    mapping (address => uint)                      public balanceOf;
    mapping (address => mapping (address => uint)) public allowance;
    mapping (address => uint)                      public nonces;

    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);

    // --- Math ---
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x);
    }
    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x);
    }

    // --- EIP712 niceties ---
    bytes32 public DOMAIN_SEPARATOR;
    // bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
    bytes32 public constant PERMIT_TYPEHASH = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;

    constructor(uint256 chainId_) public {
        wards[msg.sender] = 1;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            chainId_,
            address(this)
        ));
    }

    // --- Token ---
    function transfer(address dst, uint wad) external returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }
    function transferFrom(address src, address dst, uint wad)
        public returns (bool)
    {
        require(balanceOf[src] >= wad, "Dai/insufficient-balance");
        if (src != msg.sender && allowance[src][msg.sender] != uint(-1)) {
            require(allowance[src][msg.sender] >= wad, "Dai/insufficient-allowance");
            allowance[src][msg.sender] = sub(allowance[src][msg.sender], wad);
        }
        balanceOf[src] = sub(balanceOf[src], wad);
        balanceOf[dst] = add(balanceOf[dst], wad);
        emit Transfer(src, dst, wad);
        return true;
    }
    function mint(address usr, uint wad) external auth {
        balanceOf[usr] = add(balanceOf[usr], wad);
        totalSupply    = add(totalSupply, wad);
        emit Transfer(address(0), usr, wad);
    }
    function burn(address usr, uint wad) external {
        require(balanceOf[usr] >= wad, "Dai/insufficient-balance");
        if (usr != msg.sender && allowance[usr][msg.sender] != uint(-1)) {
            require(allowance[usr][msg.sender] >= wad, "Dai/insufficient-allowance");
            allowance[usr][msg.sender] = sub(allowance[usr][msg.sender], wad);
        }
        balanceOf[usr] = sub(balanceOf[usr], wad);
        totalSupply    = sub(totalSupply, wad);
        emit Transfer(usr, address(0), wad);
    }
    function approve(address usr, uint wad) external returns (bool) {
        allowance[msg.sender][usr] = wad;
        emit Approval(msg.sender, usr, wad);
        return true;
    }

    // --- Alias ---
    function push(address usr, uint wad) external {
        transferFrom(msg.sender, usr, wad);
    }
    function pull(address usr, uint wad) external {
        transferFrom(usr, msg.sender, wad);
    }
    function move(address src, address dst, uint wad) external {
        transferFrom(src, dst, wad);
    }

    // --- Approve by signature ---
    function permit(address holder, address spender, uint256 nonce, uint256 expiry,
                    bool allowed, uint8 v, bytes32 r, bytes32 s) external
    {
        bytes32 digest =
            keccak256(abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH,
                                     holder,
                                     spender,
                                     nonce,
                                     expiry,
                                     allowed))
        ));

        require(holder != address(0), "Dai/invalid-address-0");
        require(holder == ecrecover(digest, v, r, s), "Dai/invalid-permit");
        require(expiry == 0 || now <= expiry, "Dai/permit-expired");
        require(nonce == nonces[holder]++, "Dai/invalid-nonce");
        uint wad = allowed ? uint(-1) : 0;
        allowance[holder][spender] = wad;
        emit Approval(holder, spender, wad);
    }
}`;

  const splitter = new GenericCodeSplitter(
    ["contract", "mapping", "modifier", "function"],
    { chunkSize: 10, chunkOverlap: 0 }
  );
  const docs = await splitter.createDocuments([text]);

  expect(docs.length).toBe(19);
});

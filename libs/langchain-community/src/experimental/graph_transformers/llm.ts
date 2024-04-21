import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import {
  Node,
  Relationship,
  GraphDocument,
} from "../../graphs/graph_document.js";

export const SYSTEM_PROMPT = `
# Knowledge Graph Instructions for GPT-4\n
## 1. Overview\n
You are a top-tier algorithm designed for extracting information in structured formats to build a knowledge graph.\n
Try to capture as much information from the text as possible without sacrifing accuracy. Do not add any information that is not explicitly mentioned in the text\n"
- **Nodes** represent entities and concepts.\n"
- The aim is to achieve simplicity and clarity in the knowledge graph, making it\n
accessible for a vast audience.\n
## 2. Labeling Nodes\n
- **Consistency**: Ensure you use available types for node labels.\n
Ensure you use basic or elementary types for node labels.\n
- For example, when you identify an entity representing a person, always label it as **'person'**. Avoid using more specific terms like 'mathematician' or 'scientist'
- **Node IDs**: Never utilize integers as node IDs. Node IDs should be names or human-readable identifiers found in the text.\n
- **Relationships** represent connections between entities or concepts.\n
Ensure consistency and generality in relationship types when constructing knowledge graphs. Instead of using specific and momentary types such as 'BECAME_PROFESSOR', use more general and timeless relationship types like 'PROFESSOR'. Make sure to use general and timeless relationship types!\n
## 3. Coreference Resolution\n
- **Maintain Entity Consistency**: When extracting entities, it's vital to ensure consistency.\n
If an entity, such as "John Doe", is mentioned multiple times in the text but is referred to by different names or pronouns (e.g., "Joe", "he"), always use the most complete identifier for that entity throughout the knowledge graph. In this example, use "John Doe" as the entity ID.\n
Remember, the knowledge graph should be coherent and easily understandable, so maintaining consistency in entity references is crucial.\n
## 4. Strict Compliance\n
Adhere to the rules strictly. Non-compliance will result in termination.
`;

const DEFAULT_PROMPT = /* #__PURE__ */ ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  [
    "human",
    "Tip: Make sure to answer in the correct format and do not include any explanations. Use the given format to extract information from the following input: {input}",
  ],
]);

interface OptionalEnumFieldProps {
  enumValues?: string[];
  description: string;
  isRel?: boolean;
  fieldKwargs?: object;
}

function toTitleCase(str: string): string {
  return str
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
    .join("");
}

function createOptionalEnumType({
  enumValues = undefined,
  description = "",
  isRel = false,
}: OptionalEnumFieldProps): z.ZodTypeAny {
  let schema;

  if (enumValues && enumValues.length) {
    schema = z
      .enum(enumValues as [string, ...string[]])
      .describe(
        `${description} Available options are: ${enumValues.join(", ")}.`
      );
  } else {
    const nodeInfo =
      "Ensure you use basic or elementary types for node labels.\n" +
      "For example, when you identify an entity representing a person, " +
      "always label it as **'Person'**. Avoid using more specific terms " +
      "like 'Mathematician' or 'Scientist'";
    const relInfo =
      "Instead of using specific and momentary types such as " +
      "'BECAME_PROFESSOR', use more general and timeless relationship types like " +
      "'PROFESSOR'. However, do not sacrifice any accuracy for generality";

    const additionalInfo = isRel ? relInfo : nodeInfo;

    schema = z.string().describe(description + additionalInfo);
  }

  return schema;
}

function createSchema(allowedNodes: string[], allowedRelationships: string[]) {
  const dynamicGraphSchema = z.object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          type: createOptionalEnumType({
            enumValues: allowedNodes,
            description: "The type or label of the node.",
          }),
        })
      )
      .describe("List of nodes"),
    relationships: z
      .array(
        z.object({
          sourceNodeId: z.string(),
          sourceNodeType: createOptionalEnumType({
            enumValues: allowedNodes,
            description: "The source node of the relationship.",
          }),
          relationshipType: createOptionalEnumType({
            enumValues: allowedRelationships,
            description: "The type of the relationship.",
            isRel: true,
          }),
          targetNodeId: z.string(),
          targetNodeType: createOptionalEnumType({
            enumValues: allowedNodes,
            description: "The target node of the relationship.",
          }),
        })
      )
      .describe("List of relationships."),
  });

  return dynamicGraphSchema;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToBaseNode(node: any): Node {
  return new Node({
    id: node.id,
    type: node.type ? toTitleCase(node.type) : "",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToBaseRelationship(relationship: any): Relationship {
  return new Relationship({
    source: new Node({
      id: relationship.sourceNodeId,
      type: relationship.sourceNodeType
        ? toTitleCase(relationship.sourceNodeType)
        : "",
    }),
    target: new Node({
      id: relationship.targetNodeId,
      type: relationship.targetNodeType
        ? toTitleCase(relationship.targetNodeType)
        : "",
    }),
    type: relationship.relationshipType.replace(" ", "_").toUpperCase(),
  });
}

export interface LLMGraphTransformerProps {
  llm: BaseLanguageModel;
  allowedNodes?: string[];
  allowedRelationships?: string[];
  prompt?: ChatPromptTemplate;
  strictMode?: boolean;
}

export class LLMGraphTransformer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain: any;

  allowedNodes: string[] = [];

  allowedRelationships: string[] = [];

  strictMode: boolean;

  constructor({
    llm,
    allowedNodes = [],
    allowedRelationships = [],
    prompt = DEFAULT_PROMPT,
    strictMode = true,
  }: LLMGraphTransformerProps) {
    if (typeof llm.withStructuredOutput !== "function") {
      throw new Error(
        "The specified LLM does not support the 'withStructuredOutput'. Please ensure you are using an LLM that supports this feature."
      );
    }

    this.allowedNodes = allowedNodes;
    this.allowedRelationships = allowedRelationships;
    this.strictMode = strictMode;

    // Define chain
    const schema = createSchema(allowedNodes, allowedRelationships);
    const structuredLLM = llm.withStructuredOutput(zodToJsonSchema(schema));
    this.chain = prompt.pipe(structuredLLM);
  }

  /**
   * Method that processes a single document, transforming it into a graph
   * document using an LLM based on the model's schema and constraints.
   * @param document The document to process.
   * @returns A promise that resolves to a graph document.
   */
  async processResponse(document: Document) {
    const text = document.pageContent;

    const rawSchema = await this.chain.invoke({ input: text });

    let nodes: Node[] = [];
    if (rawSchema?.nodes) {
      nodes = rawSchema.nodes.map(mapToBaseNode);
    }

    let relationships: Relationship[] = [];
    if (rawSchema?.relationships) {
      relationships = rawSchema.relationships.map(mapToBaseRelationship);
    }

    if (
      this.strictMode &&
      (this.allowedNodes.length > 0 || this.allowedRelationships.length > 0)
    ) {
      if (this.allowedNodes.length > 0) {
        const allowedNodesLowerCase = this.allowedNodes.map((node) =>
          node.toLowerCase()
        );

        // For nodes, compare lowercased types
        nodes = nodes.filter((node) =>
          allowedNodesLowerCase.includes(node.type.toLowerCase())
        );

        // For relationships, compare lowercased types for both source and target nodes
        relationships = relationships.filter(
          (rel) =>
            allowedNodesLowerCase.includes(rel.source.type.toLowerCase()) &&
            allowedNodesLowerCase.includes(rel.target.type.toLowerCase())
        );
      }

      if (this.allowedRelationships.length > 0) {
        // For relationships, compare lowercased types
        relationships = relationships.filter((rel) =>
          this.allowedRelationships
            .map((rel) => rel.toLowerCase())
            .includes(rel.type.toLowerCase())
        );
      }
    }

    return new GraphDocument({
      nodes,
      relationships,
      source: document,
    });
  }

  /**
   * Method that converts an array of documents into an array of graph
   * documents using the `processResponse` method.
   * @param documents The array of documents to convert.
   * @returns A promise that resolves to an array of graph documents.
   */
  async convertToGraphDocuments(
    documents: Document[]
  ): Promise<GraphDocument[]> {
    const results: GraphDocument[] = [];

    for (const document of documents) {
      const graphDocument = await this.processResponse(document);
      results.push(graphDocument);
    }

    return results;
  }
}

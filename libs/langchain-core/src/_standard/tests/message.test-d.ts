// : $MessageType
// :: should accept standard message types "ai", "human", "tool", "system"
// :: should accept arbitrary non-null string types
// :: should not accept null or undefined

// : $MessageToolDefinition
// :: should correctly define a tool with input and output types
// :: should default input and output types to 'unknown' when not specified

// : $MessageToolSet
// :: should correctly type a collection of named tool definitions
// :: should enforce that all values in the set are of type $MessageToolDefinition

// : $MessageToolCallBlock
// :: should correctly generate a discriminated union of tool call blocks from a structure with tools
// ::: each block must have a 'type' property equal to "tool_call"
// ::: each block must have a 'name' property corresponding to a key in the tools definition
// ::: each block must have an 'args' property matching the input type of the corresponding tool
// :: should resolve to 'never' for a structure without tools

// : $MessageStructure
// :: should correctly type a message structure with optional 'tools', 'contentBlocks', and 'properties'
// :: should validate that 'tools' conforms to $MessageToolSet
// :: should validate that 'contentBlocks' maps message types (excluding "tool") to ContentBlock
// :: should validate that 'properties' maps message types to arbitrary records

// : $MergeMessageStructure
// :: should correctly merge 'tools' from two message structures
// ::: properties from the second structure's tools should overwrite the first's
// :: should correctly merge 'contentBlocks' from two message structures
// ::: for a shared message type, content block types should be unionized
// ::: for unshared message types, content block types should be preserved
// :: should correctly merge 'properties' from two message structures
// ::: for a shared message type, properties should be merged, with the second structure's properties taking precedence

// : $MessageStructureTypes
// :: should extract all message type keys from 'contentBlocks'
// :: should extract all message type keys from 'properties'
// :: should include "tool" as a type if 'tools' are defined
// :: should not include "tool" as a type if 'tools' are not defined

// : $StandardMessageStructure
// :: should be a valid $MessageStructure
// :: should define 'contentBlocks' for "ai", "human", and "system" as ContentBlock.Text
// :: should define 'properties' for "ai" messages with 'responseMetadata' and 'usageMetadata'

// : $NormalizedMessageStructure
// :: should return the original structure if it already extends $StandardMessageStructure
// :: should merge a non-standard structure with $StandardMessageStructure
// ::: the resulting structure should contain all properties and content blocks from both
// ::: properties from the non-standard structure should override standard ones

// : $ApplyMessageProperties
// :: should add message-specific properties from a structure to a given object
// :: should return the original object type if no properties are defined for the given message type

// : BaseMessageShape
// :: with a "tool" message type
// ::: should generate a discriminated union of tool messages from the structure's tools
// :::: each variant should have 'type' literal "tool"
// :::: each variant should have a 'toolCallId' of type string
// :::: each variant should have a 'status' of "success" | "error"
// :::: each variant should have an optional 'name' corresponding to a tool
// :::: each variant's 'content' should match the corresponding tool's output type
// ::: should resolve to 'never' if the structure has no tools defined
// :: with content block message types (e.g., "human", "ai")
// ::: should generate a message object with a 'type' property matching the message type
// ::: should have a 'content' property which is an array
// :::: the array should accept content blocks defined for that message type
// :::: if tools are defined, the array should also accept tool call blocks
// ::: should correctly apply any message-specific properties defined in the structure

// : BaseMessage
// :: should represent a BaseMessageShape with a normalized structure
// :: should infer roles from the normalized structure
// :: should default to $StandardMessageStructure when no structure is provided
// :: should handle custom message types from a provided structure

// : AIMessage
// :: should be a BaseMessage with the role "ai"
// :: should default to the $StandardMessageStructure
// :: should accept a custom message structure and reflect its types

// : HumanMessage
// :: should be a BaseMessage with the role "human"
// :: should default to the $StandardMessageStructure
// :: should accept a custom message structure and reflect its types

// : SystemMessage
// :: should be a BaseMessage with the role "system"
// :: should default to the $StandardMessageStructure
// :: should accept a custom message structure and reflect its types

// : ToolMessage
// :: should be a BaseMessage with the role "tool" when tools are defined in the structure
// :: should fall back to a default tool message shape if tools are not defined
// :: should accept a custom message structure and reflect its types

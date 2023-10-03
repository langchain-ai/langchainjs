
/**
 * Abstract class representing a Graph store. Provides methods for
 * adding querying the graph and retrieving the schema.
 */
export abstract class GraphStore {
    
    abstract getSchema(): string;

    abstract query(query: string, params: any): Promise<any[]>;
}

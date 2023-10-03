export abstract class GraphStore {
    
    abstract getSchema(): string;

    abstract query(query: string, params: any): Promise<any[]>;
}

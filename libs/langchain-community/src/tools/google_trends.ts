import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * Interface for parameters required by GoogleTrendsAPI class.
 */
export interface GoogleTrendsAPIParams {
    apiKey?: string;
  }


/**
 * Tool that queries the Google Trends API
 */
export class GoogleTrendsAPI extends Tool {
    static lc_name() {
      return "GoogleTrendsAPI";
    }
  
    get lc_secrets(): { [key: string]: string } | undefined {
      return {
        apiKey: "GOOGLE_TRENDS_API_KEY",
      };
    }
  
    name = "google_trends";
  
    protected apiKey: string;

    description = `A wrapper around Google Trends API. Useful for analyzing and retrieving trending search data based on keywords, 
    categories, or regions. Input should be a search query or specific parameters for trends analysis.`;

    constructor(fields?: GoogleTrendsAPIParams) {
      super(...arguments);
      const apiKey =
        fields?.apiKey ?? getEnvironmentVariable("GOOGLE_TRENDS_API_KEY");
      if (apiKey === undefined) {
        throw new Error(
          `Google Trends API key not set. You can set it as "GOOGLE_TRENDS_API_KEY" in your environment variables.`
        );
      }
      this.apiKey = apiKey;
    }

    async _call(query: string): Promise<string> {
        const serpapiApiKey = this.apiKey;
        const params = new URLSearchParams({
          engine: "google_trends",
          api_key: serpapiApiKey,
          q: query,
        });
      
        const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
      
        if (!res.ok) {
          throw new Error(`Error fetching data from SerpAPI: ${res.statusText}`);
        }
      
        const clientDict = await res.json();
        const totalResults = clientDict.interest_over_time?.timeline_data ?? [];
      
        if (totalResults.length === 0) {
          return "No good Trend Result was found";
        }
      
        const startDate = totalResults[0].date.split(" ");
        const endDate = totalResults[totalResults.length - 1].date.split(" ");
        const values = totalResults.map((result: any) => result.values[0].extracted_value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
        const percentageChange = ((values[values.length - 1] - values[0]) / (values[0] || 1)) * 100;
      
        const relatedParams = new URLSearchParams({
          engine: "google_trends",
          api_key: serpapiApiKey,
          data_type: "RELATED_TOPICS",
          q: query,
        });
      
        const relatedRes = await fetch(`https://serpapi.com/search.json?${relatedParams.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
      
        if (!relatedRes.ok) {
          throw new Error(`Error fetching related queries from SerpAPI: ${relatedRes.statusText}`);
        }
      
        const relatedDict = await relatedRes.json();
        const rising = relatedDict.related_queries?.rising?.map((result: any) => result.query) ?? [];
        const top = relatedDict.related_queries?.top?.map((result: any) => result.query) ?? [];
      
        const doc = [
          `Query: ${query}`,
          `Date From: ${startDate[0]} ${startDate[1]}, ${startDate[2]}`,
          `Date To: ${endDate[0]} ${endDate[1]} ${endDate[2]}`,
          `Min Value: ${minValue}`,
          `Max Value: ${maxValue}`,
          `Average Value: ${avgValue}`,
          `Percent Change: ${percentageChange.toFixed(2)}%`,
          `Trend values: ${values.join(", ")}`,
          `Rising Related Queries: ${rising.join(", ")}`,
          `Top Related Queries: ${top.join(", ")}`,
        ];
      
        return doc.join("\n\n");
      }

}
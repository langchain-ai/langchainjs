import { search as DDGsearch, SafeSearchType } from 'duck-duck-scrape';
import { convert as htmlToText } from 'html-to-text';
import { Tool } from "./base.js";

export class DuckDuckGo extends Tool {
    name = "search"

    /** @ignore */
    async _call(input: string) {
        const searchResults = await DDGsearch(input, {
            safeSearch: SafeSearchType.STRICT
        });

        if (searchResults.noResults) {
            return "No good search result found";
        }

        const results = searchResults.results.map(
            ({ description }) => htmlToText(description)
        ).join("\n\n");

        return results;
    }

    description = "a search engine. useful for when you need to answer questions about current events. input should be a search term."
}
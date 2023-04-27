---
title: "SerpAPIParameters"
---

# SerpAPIParameters

## Hierarchy

- `BaseParameters`.**SerpAPIParameters**

## Properties

### q

> **q**: `string`

Search Query
Parameter defines the query you want to search. You can use anything that you
would use in a regular Google search. e.g. `inurl:`, `site:`, `intitle:`. We
also support advanced search query parameters such as as_dt and as_eq. See the
[full list](https://serpapi.com/advanced-google-query-parameters) of supported
advanced search query parameters.

#### Defined in

[langchain/src/tools/serpapi.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L46)

### as_dt?

> **as_dt**: `string`

as_dt
Parameter controls whether to include or exclude results from the site named in
the as_sitesearch parameter.

#### Defined in

[langchain/src/tools/serpapi.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L135)

### as_epq?

> **as_epq**: `string`

as_epq
Parameter identifies a phrase that all documents in the search results must
contain. You can also use the [phrase
search](https://developers.google.com/custom-search/docs/xml_results#PhraseSearchqt)
query term to search for a phrase.

#### Defined in

[langchain/src/tools/serpapi.ts:143](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L143)

### as_eq?

> **as_eq**: `string`

as_eq
Parameter identifies a word or phrase that should not appear in any documents in
the search results. You can also use the [exclude
query](https://developers.google.com/custom-search/docs/xml_results#Excludeqt)
term to ensure that a particular word or phrase will not appear in the documents
in a set of search results.

#### Defined in

[langchain/src/tools/serpapi.ts:152](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L152)

### as_lq?

> **as_lq**: `string`

as_lq
Parameter specifies that all search results should contain a link to a
particular URL. You can also use the
[link:](https://developers.google.com/custom-search/docs/xml_results#BackLinksqt)
query term for this type of query.

#### Defined in

[langchain/src/tools/serpapi.ts:160](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L160)

### as_nhi?

> **as_nhi**: `string`

as_nhi
Parameter specifies the ending value for a search range. Use as_nlo and as_nhi
to append an inclusive search range.

#### Defined in

[langchain/src/tools/serpapi.ts:172](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L172)

### as_nlo?

> **as_nlo**: `string`

as_nlo
Parameter specifies the starting value for a search range. Use as_nlo and as_nhi
to append an inclusive search range.

#### Defined in

[langchain/src/tools/serpapi.ts:166](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L166)

### as_oq?

> **as_oq**: `string`

as_oq
Parameter provides additional search terms to check for in a document, where
each document in the search results must contain at least one of the additional
search terms. You can also use the [Boolean
OR](https://developers.google.com/custom-search/docs/xml_results#BooleanOrqt)
query term for this type of query.

#### Defined in

[langchain/src/tools/serpapi.ts:181](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L181)

### as_q?

> **as_q**: `string`

as_q
Parameter provides search terms to check for in a document. This parameter is
also commonly used to allow users to specify additional terms to search for
within a set of search results.

#### Defined in

[langchain/src/tools/serpapi.ts:188](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L188)

### as_qdr?

> **as_qdr**: `string`

as_qdr
Parameter requests search results from a specified time period (quick date
range). The following values are supported:
`d[number]`: requests results from the specified number of past days. Example
for the past 10 days: `as_qdr=d10`
`w[number]`: requests results from the specified number of past weeks.
`m[number]`: requests results from the specified number of past months.
`y[number]`: requests results from the specified number of past years. Example
for the past year: `as_qdr=y`

#### Defined in

[langchain/src/tools/serpapi.ts:200](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L200)

### as_rq?

> **as_rq**: `string`

as_rq
Parameter specifies that all search results should be pages that are related to
the specified URL. The parameter value should be a URL. You can also use the
[related:](https://developers.google.com/custom-search/docs/xml_results#RelatedLinksqt)
query term for this type of query.

#### Defined in

[langchain/src/tools/serpapi.ts:208](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L208)

### as_sitesearch?

> **as_sitesearch**: `string`

as_sitesearch
Parameter allows you to specify that all search results should be pages from a
given site. By setting the as_dt parameter, you can also use it to exclude pages
from a given site from your search resutls.

#### Defined in

[langchain/src/tools/serpapi.ts:215](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L215)

### device?

> **device**: "desktop" \| "tablet" \| "mobile"

Parameter defines the device to use to get the results. It can be set to
`desktop` (default) to use a regular browser, `tablet` to use a tablet browser
(currently using iPads), or `mobile` to use a mobile browser (currently
using iPhones).

#### Inherited from

BaseParameters.device

#### Defined in

[langchain/src/tools/serpapi.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L21)

### filter?

> **filter**: `string`

Results Filtering
Parameter defines if the filters for 'Similar Results' and 'Omitted Results' are
on or off. It can be set to `1` (default) to enable these filters, or `0` to
disable these filters.

#### Defined in

[langchain/src/tools/serpapi.ts:242](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L242)

### gl?

> **gl**: `string`

Country
Parameter defines the country to use for the Google search. It's a two-letter
country code. (e.g., `us` for the United States, `uk` for United Kingdom, or
`fr` for France). Head to the [Google countries
page](https://serpapi.com/google-countries) for a full list of supported Google
countries.

#### Defined in

[langchain/src/tools/serpapi.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L112)

### google_domain?

> **google_domain**: `string`

Domain
Parameter defines the Google domain to use. It defaults to `google.com`. Head to
the [Google domains page](https://serpapi.com/google-domains) for a full list of
supported Google domains.

#### Defined in

[langchain/src/tools/serpapi.ts:103](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L103)

### hl?

> **hl**: `string`

Language
Parameter defines the language to use for the Google search. It's a two-letter
language code. (e.g., `en` for English, `es` for Spanish, or `fr` for French).
Head to the [Google languages page](https://serpapi.com/google-languages) for a
full list of supported Google languages.

#### Defined in

[langchain/src/tools/serpapi.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L120)

### ijn?

> **ijn**: `string`

Page Number (images)
Parameter defines the page number for [Google
Images](https://serpapi.com/images-results). There are 100 images per page. This
parameter is equivalent to start (offset) = ijn \* 100. This parameter works only
for [Google Images](https://serpapi.com/images-results) (set tbm to `isch`).

#### Defined in

[langchain/src/tools/serpapi.ts:278](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L278)

### kgmid?

> **kgmid**: `string`

Google Knowledge Graph ID
Parameter defines the id (`KGMID`) of the Google Knowledge Graph listing you
want to scrape. Also known as Google Knowledge Graph ID. Searches with kgmid
parameter will return results for the originally encrypted search parameters.
For some searches, kgmid may override all other parameters except start, and num
parameters.

#### Defined in

[langchain/src/tools/serpapi.ts:87](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L87)

### location?

> **location**: `string`

Location
Parameter defines from where you want the search to originate. If several
locations match the location requested, we'll pick the most popular one. Head to
[/locations.json API](https://serpapi.com/locations-api) if you need more
precise control. location and uule parameters can't be used together. Avoid
utilizing location when setting the location outside the U.S. when using Google
Shopping and/or Google Product API.

#### Defined in

[langchain/src/tools/serpapi.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L56)

### lr?

> **lr**: `string`

Set Multiple Languages
Parameter defines one or multiple languages to limit the search to. It uses
`lang_{two-letter language code}` to specify languages and `|` as a delimiter.
(e.g., `lang_fr|lang_de` will only search French and German pages). Head to the
[Google lr languages page](https://serpapi.com/google-lr-languages) for a full
list of supported languages.

#### Defined in

[langchain/src/tools/serpapi.ts:129](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L129)

### lsig?

> **lsig**: `string`

Additional Google Place ID
Parameter that you might have to use to force the knowledge graph map view to
show up. You can find the lsig ID by using our [Local Pack
API](https://serpapi.com/local-pack) or [Places Results
API](https://serpapi.com/places-results).
lsig ID is also available via a redirect Google uses within [Google My
Business](https://www.google.com/business/).

#### Defined in

[langchain/src/tools/serpapi.ts:78](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L78)

### ludocid?

> **ludocid**: `string`

Google Place ID
Parameter defines the id (`CID`) of the Google My Business listing you want to
scrape. Also known as Google Place ID.

#### Defined in

[langchain/src/tools/serpapi.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L68)

### nfpr?

> **nfpr**: `string`

Exclude Auto-corrected Results
Parameter defines the exclusion of results from an auto-corrected query that is
spelled wrong. It can be set to `1` to exclude these results, or `0` to include
them (default).

#### Defined in

[langchain/src/tools/serpapi.ts:235](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L235)

### no_cache?

> **no_cache**: `boolean`

Parameter will force SerpApi to fetch the Google results even if a cached
version is already present. A cache is served only if the query and all
parameters are exactly the same. Cache expires after 1h. Cached searches
are free, and are not counted towards your searches per month. It can be set
to `false` (default) to allow results from the cache, or `true` to disallow
results from the cache. `no_cache` and `async` parameters should not be used together.

#### Inherited from

BaseParameters.no_cache

#### Defined in

[langchain/src/tools/serpapi.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L30)

### num?

> **num**: `string`

Number of Results
Parameter defines the maximum number of results to return. (e.g., `10` (default)
returns 10 results, `40` returns 40 results, and `100` returns 100 results).

#### Defined in

[langchain/src/tools/serpapi.ts:270](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L270)

### safe?

> **safe**: `string`

Adult Content Filtering
Parameter defines the level of filtering for adult content. It can be set to
`active`, or `off` (default).

#### Defined in

[langchain/src/tools/serpapi.ts:228](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L228)

### si?

> **si**: `string`

Google Cached Search Parameters ID
Parameter defines the cached search parameters of the Google Search you want to
scrape. Searches with si parameter will return results for the originally
encrypted search parameters. For some searches, si may override all other
parameters except start, and num parameters. si can be used to scrape Google
Knowledge Graph Tabs.

#### Defined in

[langchain/src/tools/serpapi.ts:96](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L96)

### start?

> **start**: `number`

Result Offset
Parameter defines the result offset. It skips the given number of results. It's
used for pagination. (e.g., `0` (default) is the first page of results, `10` is
the 2nd page of results, `20` is the 3rd page of results, etc.).
Google Local Results only accepts multiples of `20`(e.g. `20` for the second
page results, `40` for the third page results, etc.) as the start value.

#### Defined in

[langchain/src/tools/serpapi.ts:264](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L264)

### tbm?

> **tbm**: `string`

Search Type
(to be matched) parameter defines the type of search you want to do.
It can be set to:
`(no tbm parameter)`: regular Google Search,
`isch`: [Google Images API](https://serpapi.com/images-results),
`lcl` - [Google Local API](https://serpapi.com/local-results)
`vid`: [Google Videos API](https://serpapi.com/videos-results),
`nws`: [Google News API](https://serpapi.com/news-results),
`shop`: [Google Shopping API](https://serpapi.com/shopping-results),
or any other Google service.

#### Defined in

[langchain/src/tools/serpapi.ts:255](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L255)

### tbs?

> **tbs**: `string`

Advanced Search Parameters
(to be searched) parameter defines advanced search parameters that aren't
possible in the regular query field. (e.g., advanced search for patents, dates,
news, videos, images, apps, or text contents).

#### Defined in

[langchain/src/tools/serpapi.ts:222](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L222)

### timeout?

> **timeout**: `number`

Specify the client-side timeout of the request. In milliseconds.

#### Inherited from

BaseParameters.timeout

#### Defined in

[langchain/src/tools/serpapi.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L34)

### uule?

> **uule**: `string`

Encoded Location
Parameter is the Google encoded location you want to use for the search. uule
and location parameters can't be used together.

#### Defined in

[langchain/src/tools/serpapi.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serpapi.ts#L62)

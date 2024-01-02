import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

import { Calculator } from "langchain/tools/calculator";
import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({}), new Calculator()];

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
});

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  returnIntermediateSteps: true,
});

const res = await agentExecutor.invoke({
  input: "what is the weather in SF and then LA",
});

console.log(JSON.stringify(res, null, 2));

/*
  {
    "input": "what is the weather in SF and then LA",
    "output": "The current weather in San Francisco is 52°F with broken clouds. You can find more detailed information [here](https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023).\n\nThe current weather in Los Angeles is 61°F and clear. More information can be found [here](https://www.timeanddate.com/weather/usa/los-angeles/historic?month=12&year=2023).",
    "intermediateSteps": [
      {
        "action": {
          "tool": "tavily_search_results_json",
          "toolInput": {
            "input": "weather in San Francisco"
          },
          "log": "Invoking \"tavily_search_results_json\" with {\"input\":\"weather in San Francisco\"}\n",
          "messageLog": [
            {
              "lc": 1,
              "type": "constructor",
              "id": [
                "langchain_core",
                "messages",
                "AIMessage"
              ],
              "kwargs": {
                "content": "",
                "additional_kwargs": {
                  "function_call": {
                    "name": "tavily_search_results_json",
                    "arguments": "{\"input\":\"weather in San Francisco\"}"
                  }
                }
              }
            }
          ]
        },
        "observation": "[{\"title\":\"San Francisco, CA Hourly Weather Forecast | Weather Underground\",\"url\":\"https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-28\",\"content\":\"PopularCities. San Francisco, CA warning53 °F Mostly Cloudy. Manhattan, NY warning45 °F Fog. Schiller Park, IL (60176) warning53 °F Light Rain. Boston, MA warning40 °F Fog. Houston, TX 51 °F ...\",\"score\":0.9774,\"raw_content\":null},{\"title\":\"Weather in December 2023 in San Francisco, California, USA\",\"url\":\"https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023\",\"content\":\"Currently: 52 °F. Broken clouds. (Weather station: San Francisco International Airport, USA). See more current weather Select month: December 2023 Weather in San Francisco — Graph °F Sun, Dec 17 Lo:55 6 pm Hi:57 4 Mon, Dec 18 Lo:54 12 am Hi:55 7 Lo:54 6 am Hi:55 10 Lo:57 12 pm Hi:64 9 Lo:63 6 pm Hi:64 14 Tue, Dec 19 Lo:61\",\"score\":0.96322,\"raw_content\":null},{\"title\":\"2023 Weather History in San Francisco California, United States\",\"url\":\"https://weatherspark.com/h/y/557/2023/Historical-Weather-during-2023-in-San-Francisco-California-United-States\",\"content\":\"San Francisco Temperature History 2023\\nHourly Temperature in 2023 in San Francisco\\nCompare San Francisco to another city:\\nCloud Cover in 2023 in San Francisco\\nDaily Precipitation in 2023 in San Francisco\\nObserved Weather in 2023 in San Francisco\\nHours of Daylight and Twilight in 2023 in San Francisco\\nSunrise & Sunset with Twilight and Daylight Saving Time in 2023 in San Francisco\\nSolar Elevation and Azimuth in 2023 in San Francisco\\nMoon Rise, Set & Phases in 2023 in San Francisco\\nHumidity Comfort Levels in 2023 in San Francisco\\nWind Speed in 2023 in San Francisco\\nHourly Wind Speed in 2023 in San Francisco\\nHourly Wind Direction in 2023 in San Francisco\\nAtmospheric Pressure in 2023 in San Francisco\\nData Sources\\n 59.0°F\\nPrecipitation\\nNo Report\\nWind\\n0.0 mph\\nCloud Cover\\nMostly Cloudy\\n4,500 ft\\nRaw: KSFO 030656Z 00000KT 10SM FEW005 BKN045 15/12 A3028 RMK AO2 SLP253 While having the tremendous advantages of temporal and spatial completeness, these reconstructions: (1) are based on computer models that may have model-based errors, (2) are coarsely sampled on a 50 km grid and are therefore unable to reconstruct the local variations of many microclimates, and (3) have particular difficulty with the weather in some coastal areas, especially small islands.\\n We further caution that our travel scores are only as good as the data that underpin them, that weather conditions at any given location and time are unpredictable and variable, and that the definition of the scores reflects a particular set of preferences that may not agree with those of any particular reader.\\n See all nearby weather stations\\nLatest Report — 10:56 PM\\nSun, Dec 3, 2023 1 hr, 0 min ago UTC 06:56\\nCall Sign KSFO\\nTemp.\\n\",\"score\":0.94488,\"raw_content\":null},{\"title\":\"San Francisco, California December 2023 Weather Forecast - detailed\",\"url\":\"https://www.weathertab.com/en/g/o/12/united-states/california/san-francisco/\",\"content\":\"Free Long Range Weather Forecast for San Francisco, California December 2023. Detailed graphs of monthly weather forecast, temperatures, and degree days.\",\"score\":0.93142,\"raw_content\":null},{\"title\":\"Weather in San Francisco in December 2023\",\"url\":\"https://world-weather.info/forecast/usa/san_francisco/december-2023/\",\"content\":\"San Francisco Weather Forecast for December 2023 is based on long term prognosis and previous years' statistical data. 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec December Start Week On Sunday Monday Sun Mon Tue Wed Thu Fri Sat 1 +59° +54° 2 +61° +55° 3 +63° +55° 4 +63° +55° 5 +64° +54° 6 +61°\",\"score\":0.91579,\"raw_content\":null}]"
      },
      {
        "action": {
          "tool": "tavily_search_results_json",
          "toolInput": {
            "input": "weather in Los Angeles"
          },
          "log": "Invoking \"tavily_search_results_json\" with {\"input\":\"weather in Los Angeles\"}\n",
          "messageLog": [
            {
              "lc": 1,
              "type": "constructor",
              "id": [
                "langchain_core",
                "messages",
                "AIMessage"
              ],
              "kwargs": {
                "content": "",
                "additional_kwargs": {
                  "function_call": {
                    "name": "tavily_search_results_json",
                    "arguments": "{\"input\":\"weather in Los Angeles\"}"
                  }
                }
              }
            }
          ]
        },
        "observation": "[{\"title\":\"Weather in Los Angeles in December 2023\",\"url\":\"https://world-weather.info/forecast/usa/los_angeles/december-2023/\",\"content\":\"1 +66° +54° 2 +66° +52° 3 +66° +52° 4 +72° +55° 5 +77° +57° 6 +70° +59° 7 +66°\",\"score\":0.97811,\"raw_content\":null},{\"title\":\"Weather in December 2023 in Los Angeles, California, USA - timeanddate.com\",\"url\":\"https://www.timeanddate.com/weather/usa/los-angeles/historic?month=12&year=2023\",\"content\":\"Currently: 61 °F. Clear. (Weather station: Los Angeles / USC Campus Downtown, USA). See more current weather Select month: December 2023 Weather in Los Angeles — Graph °F Sun, Dec 10 Lo:59 6 pm Hi:61 1 Mon, Dec 11 Lo:54 12 am Hi:59 2 Lo:52 6 am Hi:72 1 Lo:63 12 pm Hi:73 0 Lo:54 6 pm Hi:59 0 Tue, Dec 12 Lo:50\",\"score\":0.96765,\"raw_content\":null},{\"title\":\"Weather in Los Angeles, December 28\",\"url\":\"https://world-weather.info/forecast/usa/los_angeles/28-december/\",\"content\":\"Weather in Los Angeles, December 28. Weather Forecast for December 28 in Los Angeles, California - temperature, wind, atmospheric pressure, humidity and precipitations. ... December 26 December 27 Select date: December 29 December 30. December 28, 2023 : Atmospheric conditions and temperature °F: RealFeel °F: Atmospheric pressure inHg: Wind ...\",\"score\":0.94103,\"raw_content\":null},{\"title\":\"Los Angeles, CA Hourly Weather Forecast | Weather Underground\",\"url\":\"https://www.wunderground.com/hourly/us/ca/los-angeles/90027/date/2023-12-28\",\"content\":\"Los Angeles Weather Forecasts. Weather Underground provides local & long-range weather forecasts, weatherreports, maps & tropical weather conditions for the Los Angeles area.\",\"score\":0.92665,\"raw_content\":null},{\"title\":\"Los Angeles, California Long Range Weather Forecast\",\"url\":\"https://www.weathertab.com/en/c/2023/12/united-states/california/los-angeles/\",\"content\":\"Los Angeles, California Long Range Weather Forecast | WeatherTAB °F °C Help United States Los Angeles, California Long Range Weather Forecast Helping You Avoid Bad Weather. 30 days and beyond. Daily ForecastDaily Calendar ForecastCalendar Detailed ForecastDetail December 2023Dec 2023\",\"score\":0.92369,\"raw_content\":null}]"
      }
    ]
  }
*/

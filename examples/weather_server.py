#!/usr/bin/env python
from mcp.server.fastmcp import FastMCP
import sys

# Create a server
mcp = FastMCP(name="Weather")


@mcp.tool()
def get_temperature(city: str) -> str:
    """Get the current temperature for a city.

    This is a mock implementation that returns fake data.
    In a real application, this would call a weather API.
    """
    # Mock implementation - in a real app, this would call a weather API
    temperatures = {
        "new york": "72°F",
        "london": "65°F",
        "tokyo": "25 degrees Celsius",
        "paris": "70°F",
        "sydney": "80°F",
    }

    city_lower = city.lower()
    if city_lower in temperatures:
        return f"The current temperature in {city} is {temperatures[city_lower]}."
    else:
        return f"Temperature data not available for {city}."


@mcp.tool()
def get_forecast(city: str, days: int = 3) -> str:
    """Get the weather forecast for a city.

    Args:
        city: The name of the city to get the forecast for.
        days: The number of days to forecast (default: 3).

    Returns:
        A string containing the weather forecast.
    """
    # Mock implementation - in a real app, this would call a weather API
    forecasts = {
        "new york": "Sunny with a chance of rain",
        "london": "Cloudy with occasional showers",
        "tokyo": "Clear skies",
        "paris": "Partly cloudy",
        "sydney": "Warm and sunny",
    }

    city_lower = city.lower()
    if city_lower in forecasts:
        return f"The {days}-day forecast for {city} is: {forecasts[city_lower]}."
    else:
        return f"Forecast data not available for {city}."


# Run the server
if __name__ == "__main__":
    # Set the port using command line arguments
    # The FastMCP server will read these arguments
    if len(sys.argv) == 1:  # No arguments provided
        # Add command line arguments for the port
        sys.argv.extend(["--sse-port", "8000"])
        port = 8000
    else:
        # Check if --sse-port is already in the arguments
        if "--sse-port" in sys.argv:
            port_index = sys.argv.index("--sse-port") + 1
            if port_index < len(sys.argv):
                port = int(sys.argv[port_index])
            else:
                port = 8000
        else:
            # Add the port argument
            sys.argv.extend(["--sse-port", "8000"])
            port = 8000

    # Run with SSE transport
    print(f"Starting weather server with SSE transport on port {port}...")
    mcp.run(transport="sse")

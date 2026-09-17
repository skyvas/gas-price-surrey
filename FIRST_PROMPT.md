Gas Price Finder Web App

I want to build a simple, mobile-friendly web page that helps me find the cheapest gas prices in the Surrey, Delta, and White Rock areas of British Columbia.

Main Requirements

* Build a web page that displays the latest available gas prices for gas stations in:
    * Surrey
    * Delta
    * White Rock
* Initially, focus on regular gasoline prices.
* The page should:
    * Show gas station name
    * Show gas price
    * Show station address
    * Show which city the station is located in
    * Show when the price was last updated
    * Show the source of the price information
    * Sort stations by price, with the cheapest prices shown first
* Clearly highlight the cheapest gas price available in the selected area.

Maps Integration

* The primary purpose of the page is to make it easy to navigate to a gas station.
* Each gas station should have an “Open in Maps” button.
* When the user taps the button on their phone, it should open the gas station’s location in the device’s default/preferred Maps application where possible.
* The destination should point specifically to the selected gas station rather than simply opening a general search for gas stations.
* The experience should work on both:
    * iPhone
    * Android

Gas Price Sources

* I will provide a list of specific websites that should be used as sources for gas prices.
* Use those websites to obtain the latest available prices.
* The application should also identify additional reliable websites or publicly available sources that can provide gas prices for the Surrey, Delta, and White Rock areas.
* I want the system to use multiple sources where practical so that the application has broader coverage.
* Each price should indicate where the information came from.
* If multiple sources provide information for the same station, handle the duplicate information appropriately.
* Before using any additional source, check whether its data can legally and reliably be accessed automatically.
* Prefer official APIs, feeds, or publicly available data where available.

Location Filtering

* Only show gas stations within:
    * Surrey, BC
    * Delta, BC
    * White Rock, BC
* Do not include gas stations from surrounding cities unless they are actually within the requested geographic areas.
* The filtering should remain reliable even when different sources format city names or addresses differently.

Price Updates

* Gas prices should be checked every 30 minutes.
* The latest available information should automatically be reflected on the website.
* The page should display a clear last updated time.
* If a source is temporarily unavailable, handle the situation gracefully rather than breaking the entire website.

Hosting

* The final website must be hosted using GitHub Pages.
* I want the GitHub repository to contain the latest version of the website.
* GitHub Pages should serve the current version of the application directly from the repository/deployment process.
* I should be able to make changes to the project and have the updated website published through GitHub.

GitHub Actions

* Set up a GitHub Actions workflow that runs approximately every 30 minutes.
* The workflow should:
    * Retrieve the latest gas prices
    * Process/update the price information
    * Update the website’s data
    * Publish the updated information through GitHub Pages
* The workflow should also support being run manually when needed.

User Interface

Keep the website simple and focused.

The main page should show something similar to:

* Cheapest Gas
    * Station name
    * Price
    * Address
    * Open in Maps
* Other Gas Stations
    * Station name
    * Price
    * Address
    * City
    * Last updated
    * Source
    * Open in Maps

Include simple filtering for:

* All
* Surrey
* Delta
* White Rock

The interface should be optimized primarily for mobile phones, particularly iPhone.

Future Flexibility

Although the initial version should focus on regular gasoline, design the project so additional fuel types can be supported later, such as:

* Regular
* Mid-grade
* Premium
* Diesel

I may also want to add additional features later, such as:

* Price history
* Historical lowest price
* Price trends
* Favorite gas stations
* Distance from the user
* More geographic areas
* Additional price sources

Do not implement these future features unless they are required for the initial version.

Important

* Keep the project as simple as reasonably possible.
* Let the AI choose the appropriate technology, implementation approach, project structure, and data-processing method.
* Do not over-engineer the solution.
* Prioritize reliability, mobile usability, low operating cost, and easy maintenance.
* I will provide the initial gas-price websites that I specifically want to use.
* Once I provide those websites, determine the appropriate way to retrieve their latest available price information and incorporate them into the project.

Gas prices  url

1. https://www.gvrd.com/gas-prices/surrey.html
2. https://www.delta-optimist.com/gas-prices
3. https://www.gasbuddy.com/gasprices/british-columbia/surrey

# Steam Pricing

Browser extension that analyzes and compares Steam game prices and shows a comparison between developer set price and valve recommended.

## Features

- Shows price comparisons for the current Steam store page.
- Currency/region-aware formatting.

## Usage

- Navigate to a Steam store page for a game, then click the extension toolbar icon to open the popup.

## Developing

Repository contains 2 dirs with extension and rust parser for umm... receiving json from Valve pricing [explorer](https://partner.steamgames.com/pricing/explorer). Generally everyone should be interested in [extension dir](./extension/) for source code of browser extension.

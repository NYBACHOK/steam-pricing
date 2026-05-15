use std::{sync::LazyLock, time::Duration};

use anyhow::Context;
use clap::Parser;
use regex::Regex;
use scraper::{Html, Selector};
use thirtyfour::{By, ChromiumLikeCapabilities, DesiredCapabilities, WebDriver};

const STEAMWORKS_PAGE: &str = "https://partner.steamgames.com/pricing/explorer";

static NUMBER_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[0-9]+[.,][0-9]{2}").expect("valid regex"));

#[derive(clap::Parser)]
struct Args {
    /// Display web engine
    #[arg(short, long, required = false, default_value_t = false)]
    visible: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let Args { visible } = Args::parse();

    let mut caps = DesiredCapabilities::chrome();
    if visible {
        caps.unset_headless()?;
    } else {
        caps.set_headless()?;
    }
    let driver = WebDriver::managed(caps).latest().await?;

    driver.goto(STEAMWORKS_PAGE).await?;

    tokio::time::sleep(Duration::from_secs(1)).await;

    let range = usd_prices_selector(&driver).await?;

    Ok(())
}

async fn usd_prices_selector(driver: &WebDriver) -> anyhow::Result<Vec<f64>> {
    static SELECTOR: LazyLock<Selector> =
        LazyLock::new(|| Selector::parse(BUTTON_SELECTOR).expect("selector is always valid"));

    let document = Html::parse_document(&driver.source().await?);

    const BUTTON_SELECTOR: &str = "button[class^='INXuF']";

    let prices = document
        .select(&SELECTOR)
        .filter_map(|this| {
            let this = this.text().collect::<Vec<_>>().join("");

            NUMBER_REGEX
                .find(&this)
                .and_then(|m| m.as_str().parse::<f64>().ok())
        })
        .collect::<Vec<_>>();

    Ok(prices)
}

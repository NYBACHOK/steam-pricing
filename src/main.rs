use std::path::PathBuf;

use anyhow::Context;
use pest::Parser;
use serde::{Deserialize, Serialize};

const STEAMWORKS_PAGE: &str = "https://partner.steamgames.com/pricing/explorer";

#[derive(pest_derive::Parser)]
#[grammar = "../../parser.pest"]
struct JsonParser;

#[derive(clap::Parser)]
struct Args {
    #[arg(short, long, required = false, default_value_os_t  = std::env::current_dir().unwrap_or_default().join("pricing_table.json"))]
    output: PathBuf,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct RenderContext {
    query_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryData {
    pub queries: Vec<QueryEntry>,
}

/// Single query entry.
///
/// `state.data` can contain either:
/// - an array of pricing objects, or
/// - a settings object (`preference_state`, `version`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryEntry {
    pub state: QueryState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryState {
    pub data: QueryStateData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum QueryStateData {
    PricingList(Vec<PricingEntry>),
    PreferenceState(PreferenceState),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingEntry {
    pub convert_method: u8,
    pub currency_prices: Vec<CurrencyPrice>,
    pub region_prices: Vec<RegionPrice>,
    pub usd_price: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyPrice {
    pub currency_code: u16,
    pub price: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionPrice {
    pub currency_code: u16,
    pub price: u64,
    pub region_code: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreferenceState {}

fn main() -> anyhow::Result<()> {
    let Args { output } = <Args as clap::Parser>::parse();

    let page = reqwest::blocking::Client::new()
        .get(STEAMWORKS_PAGE)
        .send()
        .context("failed to get steam page")?
        .text()?;

    let mut pairs = JsonParser::parse(Rule::find_sc, &page).context("failed to parse page")?;

    // This is LITERALLY JSON STRING
    // serialization will fail if you parse it as struct, so you need to extract it first
    // I'm too tired to deal with during parsing so do dumb serialization below
    let json_string = pairs
        .find(|this| this.as_rule() == Rule::find_sc)
        .and_then(|this| this.into_inner().find(|this| this.as_rule() == Rule::JSON))
        .and_then(|this| {
            this.into_inner()
                .find(|this| this.as_rule() == Rule::JSON_INNER)
        })
        .context("failed to find json with table")?
        .as_str();

    let query_data =
        serde_json::from_str::<RenderContext>(&serde_json::from_str::<String>(json_string)?)?
            .query_data;

    let items = serde_json::from_str::<QueryData>(&query_data)?
        .queries
        .into_iter()
        .filter_map(|this| match this.state.data {
            QueryStateData::PricingList(items) => Some(items),
            QueryStateData::PreferenceState(_) => None,
        })
        .flatten()
        .collect::<Vec<_>>();

    std::fs::write(
        output,
        serde_json::to_string_pretty(&items).expect("never fails"),
    )
    .context("failed to save parsed table")?;

    Ok(())
}

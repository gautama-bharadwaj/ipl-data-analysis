# IPL data analysis: how T20 batting changed

A few years ago 180 was a good IPL total. Now 210–220 often isn't enough. This project uses ball-by-ball data for every IPL match from 2008 to 2026 to find out **what changed, when it changed, and why**, and publishes the results as a GitHub Pages site with lots of interactive charts.

- **The story** (`docs/index.html`): the jump in totals, when it happened (a change-point test points to 2023), where in the innings it happened, and a verdict on four theories: flatter pitches, shorter boundaries, a more attacking mindset, and the Impact Player rule.
- **The explorer** (`docs/explore.html`): compare any team, ground or player with the league, season by season, plus sortable leaderboards.

## Data

Ball-by-ball JSON from [Cricsheet](https://cricsheet.org/) (`dataset/ipl_json/`, 1,243 matches). Cricsheet is still the best free, openly licensed source of IPL ball-by-ball data. It doesn't include boundary rope lengths, pitch reports or bowler types, so the site says where a theory can only be tested indirectly.

## Pipeline

```bash
pip install -r requirements.txt
python scripts/fetch_data.py        # download the latest Cricsheet IPL archive
python scripts/build_tables.py      # JSON -> dataset/processed/*.csv
python scripts/build_site_data.py   # analysis -> docs/data/*.json
```

| Output | What it is |
|---|---|
| `dataset/processed/matches.csv` | One row per match, with cleaned team and venue names and a `full_length` flag (no rain rules) |
| `dataset/processed/innings.csv` | One row per innings: runs, wickets, balls, batters used |
| `dataset/processed/deliveries.csv.gz` | One row per ball, with phase, batting position and wickets already lost |
| `dataset/processed/impact_subs.csv` | Every Impact Player substitution since 2023 |
| `docs/data/*.json` | Pre-computed numbers the website reads |

Renamed franchises are merged under their current names (Delhi Daredevils → Delhi Capitals, Kings XI Punjab → Punjab Kings, Royal Challengers Bangalore → Bengaluru). Venue spellings are merged into one name per ground. Comparisons of totals use full-length matches only.

## Viewing the site

Locally: `cd docs && python -m http.server`, then open http://localhost:8000.

On GitHub Pages: in **Settings → Pages**, set **Source** to **GitHub Actions**. The `Deploy site to GitHub Pages` workflow publishes `docs/` on every push to `main` that touches it. To pull in a new season, run the `Refresh data from Cricsheet` workflow from the Actions tab. It downloads the data, rebuilds everything, commits, and redeploys.

## Older script

`scripts/json_to_csv.py` is the original match-level converter and writes `dataset/csv/matches.csv`. The new pipeline above replaces it.

## Acknowledgements

- [Cricsheet](https://cricsheet.org/) for the data.
- [Apache ECharts](https://echarts.apache.org/) for the charts (bundled in `docs/assets/vendor/`).

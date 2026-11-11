"""Turn Cricsheet IPL JSON files into clean, analysis-ready tables.

Outputs (in dataset/processed/):
  matches.csv          one row per match
  innings.csv          one row per regular innings (super overs excluded)
  deliveries.csv.gz    one row per ball bowled (super overs excluded)
  impact_subs.csv      one row per Impact Player substitution (2023 onward)

Run from the repo root:  python scripts/build_tables.py
"""
import csv
import glob
import gzip
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dataset", "ipl_json")
OUT = os.path.join(ROOT, "dataset", "processed")

# Franchises that were renamed are folded into their current name so a team's
# history reads as one line. Defunct franchises keep their own name.
TEAM_ALIASES = {
    "Delhi Daredevils": "Delhi Capitals",
    "Kings XI Punjab": "Punjab Kings",
    "Royal Challengers Bangalore": "Royal Challengers Bengaluru",
    "Rising Pune Supergiants": "Rising Pune Supergiant",
}

# Cricsheet spells the same ground several ways. Map a keyword to one name.
VENUE_KEYS = [
    ("Arun Jaitley", "Arun Jaitley Stadium, Delhi"),
    ("Feroz Shah Kotla", "Arun Jaitley Stadium, Delhi"),
    ("Wankhede", "Wankhede Stadium, Mumbai"),
    ("Brabourne", "Brabourne Stadium, Mumbai"),
    ("DY Patil", "DY Patil Stadium, Navi Mumbai"),
    ("Eden Gardens", "Eden Gardens, Kolkata"),
    ("Chinnaswamy", "M Chinnaswamy Stadium, Bengaluru"),
    ("Chidambaram", "MA Chidambaram Stadium, Chennai"),
    ("Rajiv Gandhi", "Rajiv Gandhi Intl Stadium, Hyderabad"),
    ("Sawai Mansingh", "Sawai Mansingh Stadium, Jaipur"),
    ("Punjab Cricket Association", "PCA Stadium, Mohali"),
    ("Maharaja Yadavindra", "Maharaja Yadavindra Singh Stadium, Mullanpur"),
    ("Narendra Modi", "Narendra Modi Stadium, Ahmedabad"),
    ("Sardar Patel", "Narendra Modi Stadium, Ahmedabad"),
    ("Ekana", "Ekana Stadium, Lucknow"),
    ("Maharashtra Cricket", "MCA Stadium, Pune"),
    ("Subrata Roy", "Subrata Roy Sahara Stadium, Pune"),
    ("Rajasekhara Reddy", "ACA-VDCA Stadium, Visakhapatnam"),
    ("Visakhapatnam", "ACA-VDCA Stadium, Visakhapatnam"),
    ("Himachal Pradesh", "HPCA Stadium, Dharamsala"),
    ("Barsapara", "Barsapara Stadium, Guwahati"),
    ("Dubai International", "Dubai International Stadium"),
    ("Sharjah", "Sharjah Cricket Stadium"),
    ("Zayed", "Sheikh Zayed Stadium, Abu Dhabi"),
]


def team(name):
    return TEAM_ALIASES.get(name, name)


def venue(name):
    for key, canon in VENUE_KEYS:
        if key in name:
            return canon
    return name


def phase(over):
    if over < 6:
        return "Powerplay"
    if over < 15:
        return "Middle"
    return "Death"


def main():
    os.makedirs(OUT, exist_ok=True)
    matches, innings_rows, deliveries, subs = [], [], [], []

    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    for path in files:
        match_id = int(os.path.basename(path)[:-5])
        with open(path) as fh:
            data = json.load(fh)
        info = data["info"]
        date = info["dates"][0]
        season = int(date[:4])
        outcome = info.get("outcome", {})
        teams = [team(t) for t in info["teams"]]
        winner = team(outcome["winner"]) if "winner" in outcome else ""
        regular = [i for i in data.get("innings", []) if not i.get("super_over")]
        target = regular[1].get("target", {}) if len(regular) > 1 else {}
        # A match is "full length" if no rain rule was applied and the chase
        # was set over 20 overs. Totals from shortened games are excluded from
        # total-based comparisons.
        full_length = (
            "method" not in outcome
            and outcome.get("result") != "no result"
            and target.get("overs", 20) == 20
            and len(regular) == 2
        )
        toss = info.get("toss", {})
        matches.append({
            "match_id": match_id,
            "season": season,
            "date": date,
            "city": info.get("city", ""),
            "venue": venue(info["venue"]),
            "venue_raw": info["venue"],
            "team1": teams[0],
            "team2": teams[1],
            "toss_winner": team(toss.get("winner", "")),
            "toss_decision": toss.get("decision", ""),
            "winner": winner,
            "result": outcome.get("result", "win"),
            "win_by_runs": outcome.get("by", {}).get("runs", ""),
            "win_by_wickets": outcome.get("by", {}).get("wickets", ""),
            "method": outcome.get("method", ""),
            "super_over": int(any(i.get("super_over") for i in data.get("innings", []))),
            "stage": info.get("event", {}).get("stage", "League"),
            "player_of_match": ";".join(info.get("player_of_match", [])),
            "full_length": int(full_length),
        })

        for inn_no, inn in enumerate(regular, start=1):
            bat = team(inn["team"])
            bowl = teams[1] if bat == teams[0] else teams[0]
            order = {}  # batter -> batting position
            runs = wkts = legal = 0
            for ov in inn["overs"]:
                over = ov["over"]
                ball_no = 0
                for d in ov["deliveries"]:
                    for name in (d["batter"], d["non_striker"]):
                        if name not in order:
                            order[name] = len(order) + 1
                    extras = d.get("extras", {})
                    is_wide = "wides" in extras
                    is_nb = "noballs" in extras
                    is_legal = not (is_wide or is_nb)
                    if is_legal:
                        ball_no += 1
                        legal += 1
                    w = d.get("wickets", [])
                    kinds = [x["kind"] for x in w]
                    # Retired hurt is not a dismissal for bowling or averages.
                    real_w = [x for x in w if x["kind"] not in ("retired hurt", "retired not out")]
                    bowler_w = [x for x in real_w if x["kind"] not in ("run out", "obstructing the field", "retired out")]
                    runs += d["runs"]["total"]
                    wkts += len(real_w)
                    for rep in d.get("replacements", {}).get("match", []):
                        if rep.get("reason") == "impact_player":
                            subs.append({
                                "match_id": match_id,
                                "season": season,
                                "team": team(rep["team"]),
                                "player_in": rep["in"],
                                "player_out": rep["out"],
                                "innings": inn_no,
                                "over": over,
                            })
                    deliveries.append({
                        "match_id": match_id,
                        "season": season,
                        "venue": venue(info["venue"]),
                        "innings": inn_no,
                        "batting_team": bat,
                        "bowling_team": bowl,
                        "over": over,
                        "ball": ball_no,
                        "phase": phase(over),
                        "batter": d["batter"],
                        "batting_position": order[d["batter"]],
                        "non_striker": d["non_striker"],
                        "bowler": d["bowler"],
                        "runs_batter": d["runs"]["batter"],
                        "runs_extras": d["runs"]["extras"],
                        "runs_total": d["runs"]["total"],
                        "is_wide": int(is_wide),
                        "is_noball": int(is_nb),
                        "is_legal": int(is_legal),
                        "is_four": int(d["runs"]["batter"] == 4 and not d["runs"].get("non_boundary")),
                        "is_six": int(d["runs"]["batter"] == 6),
                        "wicket": len(real_w),
                        "bowler_wicket": len(bowler_w),
                        "wicket_kind": ";".join(kinds),
                        "player_out": ";".join(x["player_out"] for x in w),
                        "wickets_before": wkts - len(real_w),
                        "full_length": int(full_length),
                    })
            innings_rows.append({
                "match_id": match_id,
                "season": season,
                "venue": venue(info["venue"]),
                "innings": inn_no,
                "batting_team": bat,
                "bowling_team": bowl,
                "runs": runs,
                "wickets": wkts,
                "legal_balls": legal,
                "batters_used": len(order),
                "won": int(winner == bat),
                "target": inn.get("target", {}).get("runs", ""),
                "full_length": int(full_length),
            })

    def write(name, rows, gz=False):
        path = os.path.join(OUT, name)
        opener = gzip.open if gz else open
        with opener(path, "wt", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"wrote {len(rows):>7} rows -> {os.path.relpath(path, ROOT)}")

    write("matches.csv", matches)
    write("innings.csv", innings_rows)
    write("deliveries.csv.gz", deliveries, gz=True)
    write("impact_subs.csv", subs)


if __name__ == "__main__":
    main()

"""Compute every number the website shows and write it as JSON to docs/data/.

Run after build_tables.py, from the repo root:  python scripts/build_site_data.py
"""
import json
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(ROOT, "dataset", "processed")
OUT = os.path.join(ROOT, "docs", "data")

IMPACT_SEASON = 2023
ERAS = [
    ("2008–12", 2008, 2012),
    ("2013–17", 2013, 2017),
    ("2018–22", 2018, 2022),
    ("2023–26", 2023, 2100),
]


def r(x, n=2):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), n)


def era_of(season):
    for name, a, b in ERAS:
        if a <= season <= b:
            return name
    return None


def save(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":"))
    print(f"wrote {os.path.getsize(path)/1024:7.1f} KB -> docs/data/{name}")


def records(df):
    out = []
    for row in df.to_dict("records"):
        out.append({k: (r(v, 3) if isinstance(v, float) else v) for k, v in row.items()})
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    m = pd.read_csv(os.path.join(PROC, "matches.csv"))
    inn = pd.read_csv(os.path.join(PROC, "innings.csv"))
    d = pd.read_csv(os.path.join(PROC, "deliveries.csv.gz"))
    subs = pd.read_csv(os.path.join(PROC, "impact_subs.csv"))

    d["dot"] = ((d.runs_total == 0) & (d.is_legal == 1)).astype(int)
    d["boundary_runs"] = d.is_four * 4 + d.is_six * 6
    seasons = sorted(d.season.unique().tolist())
    first = inn[(inn.innings == 1) & (inn.full_length == 1)]
    chase = inn[(inn.innings == 2) & (inn.full_length == 1)]

    # ------------------------------------------------------------------
    # 1. Season summary
    # ------------------------------------------------------------------
    g = d.groupby("season")
    s = pd.DataFrame({
        "matches": g.match_id.nunique(),
        "runs": g.runs_total.sum(),
        "balls": g.is_legal.sum(),
        "wickets": g.wicket.sum(),
        "fours": g.is_four.sum(),
        "sixes": g.is_six.sum(),
        "dots": g.dot.sum(),
        "boundary_runs": g.boundary_runs.sum(),
        "extras": g.runs_extras.sum(),
    })
    s["run_rate"] = s.runs / s.balls * 6
    s["runs_per_wicket"] = s.runs / s.wickets
    s["dot_pct"] = s.dots / s.balls * 100
    s["boundary_pct"] = (s.fours + s.sixes) / s.balls * 100
    s["boundary_run_share"] = s.boundary_runs / s.runs * 100
    s["sixes_per_match"] = s.sixes / s.matches
    s["fours_per_match"] = s.fours / s.matches
    s["six_four_ratio"] = s.sixes / s.fours
    s["balls_per_six"] = s.balls / s.sixes
    s["wickets_per_innings"] = s.wickets / inn.groupby("season").size()
    fg = first.groupby("season").runs
    s["avg_first_innings"] = fg.mean()
    s["median_first_innings"] = fg.median()
    s["pct_200_plus"] = fg.apply(lambda x: (x >= 200).mean() * 100)
    s["pct_220_plus"] = fg.apply(lambda x: (x >= 220).mean() * 100)
    s["pct_under_160"] = fg.apply(lambda x: (x < 160).mean() * 100)
    s["highest_total"] = inn.groupby("season").runs.max()
    s["count_200_plus"] = inn.groupby("season").runs.apply(lambda x: int((x >= 200).sum()))
    s["count_250_plus"] = inn.groupby("season").runs.apply(lambda x: int((x >= 250).sum()))
    # Batting-first win % and successful 200+ chases
    fl = m[(m.full_length == 1) & (m.winner.notna())]
    bf = first.merge(fl[["match_id"]], on="match_id")
    s["bat_first_win_pct"] = bf.groupby("season").won.mean() * 100
    big = chase[chase.target > 200]
    s["chases_200_attempted"] = big.groupby("season").size()
    s["chases_200_won"] = big.groupby("season").won.sum()
    s = s.fillna(0).reset_index()
    save("seasons.json", records(s))

    # Distribution of first-innings totals per season (box-plot ready)
    dist = []
    for season, x in first.groupby("season").runs:
        q = np.percentile(x, [5, 25, 50, 75, 95])
        dist.append({"season": int(season), "p5": q[0], "p25": q[1], "p50": q[2],
                     "p75": q[3], "p95": q[4], "min": int(x.min()), "max": int(x.max()),
                     "n": int(len(x))})
    # Histogram of totals by era (10-run bins)
    bins = list(range(80, 300, 10))
    hist = {}
    for name, a, b in ERAS:
        x = first[(first.season >= a) & (first.season <= b)].runs
        h, _ = np.histogram(x, bins=bins)
        hist[name] = (h / h.sum() * 100).round(2).tolist()
    save("totals.json", {"box": records(pd.DataFrame(dist)), "bins": bins[:-1], "hist": hist,
                         "eras": [e[0] for e in ERAS]})

    # ------------------------------------------------------------------
    # 2. Phases and overs
    # ------------------------------------------------------------------
    pg = d.groupby(["season", "phase"])
    ph = pd.DataFrame({
        "run_rate": pg.runs_total.sum() / pg.is_legal.sum() * 6,
        "wickets_per_over": pg.wicket.sum() / pg.is_legal.sum() * 6,
        "dot_pct": pg.dot.sum() / pg.is_legal.sum() * 100,
        "boundary_pct": (pg.is_four.sum() + pg.is_six.sum()) / pg.is_legal.sum() * 100,
        "sixes_per_innings": pg.is_six.sum() / d.groupby("season").apply(lambda x: x[["match_id", "innings"]].drop_duplicates().shape[0]),
    }).reset_index()
    save("phases.json", records(ph))

    og = d[d.over < 20].groupby(["season", "over"])
    ov = pd.DataFrame({"run_rate": og.runs_total.sum() / og.is_legal.sum() * 6,
                       "wickets": og.wicket.sum() / og.is_legal.sum() * 6}).reset_index()
    d["era"] = d.season.map(era_of)
    eg = d[d.over < 20].groupby(["era", "over"])
    ev = pd.DataFrame({"run_rate": eg.runs_total.sum() / eg.is_legal.sum() * 6}).reset_index()
    save("overs.json", {"by_season": records(ov), "by_era": records(ev)})

    # ------------------------------------------------------------------
    # 3. Change-point: where does the run rate step up?
    # Per-innings run rate for full-length games, best single break and the
    # size of the jump either side of it.
    # ------------------------------------------------------------------
    full = inn[inn.full_length == 1].copy()
    full["rr"] = full.runs / full.legal_balls * 6
    rr_season = full.groupby("season").rr.mean()
    best = None
    for brk in seasons[3:-1]:
        a = full[full.season < brk].rr
        b = full[full.season >= brk].rr
        sse = ((a - a.mean()) ** 2).sum() + ((b - b.mean()) ** 2).sum()
        if best is None or sse < best[1]:
            best = (brk, sse, a.mean(), b.mean())
    scan = []
    for brk in seasons[3:-1]:
        a = full[full.season < brk].rr
        b = full[full.season >= brk].rr
        sse = ((a - a.mean()) ** 2).sum() + ((b - b.mean()) ** 2).sum()
        scan.append({"season": int(brk), "sse": r(sse, 1)})
    base = scan and max(x["sse"] for x in scan)
    for x in scan:
        x["fit_gain"] = r((base - x["sse"]) / base * 100, 2)
    # Year-over-year jumps in run rate
    yoy = [{"season": int(b), "change": r(rr_season[b] - rr_season[a], 3)}
           for a, b in zip(seasons[:-1], seasons[1:])]
    save("changepoint.json", {
        "break_season": int(best[0]), "rr_before": r(best[2]), "rr_after": r(best[3]),
        "scan": scan, "yoy": yoy,
        "rr_by_season": [{"season": int(k), "rr": r(v, 3)} for k, v in rr_season.items()],
    })

    # ------------------------------------------------------------------
    # 4. Theory: pitches got flatter
    # (a) league batting average (runs per wicket) and powerplay wickets
    # (b) season effect on run rate after controlling for venue
    # (c) same ground, before vs after
    # ------------------------------------------------------------------
    full["venue"] = full.venue.astype(str)
    vcount = full.venue.value_counts()
    fv = full[full.venue.isin(vcount[vcount >= 20].index)]
    X_season = pd.get_dummies(fv.season.astype(str), prefix="s", drop_first=True, dtype=float)
    X_venue = pd.get_dummies(fv.venue, prefix="v", drop_first=True, dtype=float)
    X = np.column_stack([np.ones(len(fv)), X_season.values, X_venue.values])
    beta, *_ = np.linalg.lstsq(X, fv.rr.values, rcond=None)
    s0 = sorted(fv.season.unique())[0]
    raw0 = fv[fv.season == s0].rr.mean()
    venue_adj = [{"season": int(s0), "adjusted": 0.0, "raw": 0.0}]
    for i, col in enumerate(X_season.columns):
        yr = int(col[2:])
        venue_adj.append({"season": yr, "adjusted": r(beta[1 + i], 3),
                          "raw": r(fv[fv.season == yr].rr.mean() - raw0, 3)})

    pp = d[d.phase == "Powerplay"].groupby("season")
    pitch = {
        "venue_adjusted": venue_adj,
        "pp_wickets_per_innings": [{"season": int(k), "value": r(v, 3)} for k, v in
                                   (pp.wicket.sum() / inn.groupby("season").size()).items()],
    }
    # Same-ground comparison 2018–22 vs 2023–26
    before = full[(full.season >= 2018) & (full.season <= 2022) & (full.innings == 1)]
    after = full[(full.season >= IMPACT_SEASON) & (full.innings == 1)]
    bv = before.groupby("venue").runs.agg(["mean", "size"])
    av = after.groupby("venue").runs.agg(["mean", "size"])
    both = bv.join(av, lsuffix="_before", rsuffix="_after").dropna()
    both = both[(both.size_before >= 6) & (both.size_after >= 6)].sort_values("mean_after", ascending=False)
    pitch["same_ground"] = [{"venue": v, "before": r(x.mean_before, 1), "after": r(x.mean_after, 1),
                             "n_before": int(x.size_before), "n_after": int(x.size_after)}
                            for v, x in both.iterrows()]
    # Venue × season heatmap of run rate (venues with at least 25 games)
    vh = full[full.venue.isin(vcount[vcount >= 25].index)].groupby(["venue", "season"]).rr.agg(["mean", "size"]).reset_index()
    pitch["venue_heat"] = [{"venue": x.venue, "season": int(x.season), "rr": r(x["mean"]), "n": int(x["size"])}
                           for _, x in vh.iterrows()]
    save("pitch.json", pitch)

    # ------------------------------------------------------------------
    # 5. Theory: boundaries got shorter (proxy only: Cricsheet has no rope sizes)
    # ------------------------------------------------------------------
    vs = d.groupby(["venue", "season"]).agg(sixes=("is_six", "sum"), m=("match_id", "nunique")).reset_index()
    vs["era"] = vs.season.map(era_of)
    ve = vs.groupby(["venue", "era"]).agg(sixes=("sixes", "sum"), m=("m", "sum")).reset_index()
    ve = ve[ve.m >= 6]
    ve["sixes_per_match"] = ve.sixes / ve.m
    keep = ve.groupby("venue").era.nunique()
    ve = ve[ve.venue.isin(keep[keep >= 3].index)]
    # Average distance proxy: share of boundaries that are sixes, and sixes per
    # over by phase. Shorter ropes would lift sixes across all phases and grounds.
    save("boundaries.json", {
        "venue_era_sixes": records(ve[["venue", "era", "sixes_per_match", "m"]]),
    })

    # ------------------------------------------------------------------
    # 6. Theory: a more attacking mindset
    # ------------------------------------------------------------------
    legal = d[d.is_legal == 1].copy()
    legal["nth_ball"] = legal.groupby(["match_id", "innings", "batter"]).cumcount() + 1
    start = legal[legal.nth_ball <= 10].groupby("season")
    settled = legal[legal.nth_ball > 20].groupby("season")
    # Individual batting seasons: share of batters (min 100 balls) with SR >= 150
    pb = legal.groupby(["season", "batter"]).agg(runs=("runs_batter", "sum"), balls=("is_legal", "sum")).reset_index()
    pb = pb[pb.balls >= 100]
    pb["sr"] = pb.runs / pb.balls * 100
    mindset = {
        "first10_sr": [{"season": int(k), "value": r(v * 100, 2)} for k, v in
                       (start.runs_batter.sum() / start.is_legal.sum()).items()],
        "settled_sr": [{"season": int(k), "value": r(v * 100, 2)} for k, v in
                       (settled.runs_batter.sum() / settled.is_legal.sum()).items()],
        "share_sr150": [{"season": int(k), "value": r(v * 100, 2)} for k, v in
                        pb.groupby("season").sr.apply(lambda x: (x >= 150).mean()).items()],
        "sr_dist": [],
    }
    for season, x in pb.groupby("season"):
        q = np.percentile(x.sr, [10, 25, 50, 75, 90])
        mindset["sr_dist"].append({"season": int(season), "p10": r(q[0]), "p25": r(q[1]), "p50": r(q[2]),
                                   "p75": r(q[3]), "p90": r(q[4])})
    # Risk vs reward per season: batting strike rate vs runs per wicket
    bat = d.groupby("season").agg(rb=("runs_batter", "sum"), b=("is_legal", "sum"), w=("wicket", "sum"), rt=("runs_total", "sum"))
    mindset["risk_reward"] = [{"season": int(k), "sr": r(x.rb / x.b * 100), "avg": r(x.rt / x.w)} for k, x in bat.iterrows()]
    save("mindset.json", mindset)

    # ------------------------------------------------------------------
    # 7. Theory: the Impact Player rule
    # ------------------------------------------------------------------
    d["pos_group"] = pd.cut(d.batting_position, [0, 3, 7, 11], labels=["Top order (1–3)", "Middle order (4–7)", "Lower order (8–11)"])
    n_inn = inn.groupby("season").size()
    posruns = d.groupby(["season", "pos_group"], observed=True).runs_batter.sum().unstack()
    posballs = d[d.is_legal == 1].groupby(["season", "pos_group"], observed=True).is_legal.sum().unstack()
    impact = {"pos_runs_per_innings": [], "pos_sr": [], "pos_balls_share": []}
    for season in seasons:
        for grp in posruns.columns:
            impact["pos_runs_per_innings"].append({"season": int(season), "group": grp, "value": r(posruns.loc[season, grp] / n_inn[season])})
            impact["pos_sr"].append({"season": int(season), "group": grp, "value": r(posruns.loc[season, grp] / posballs.loc[season, grp] * 100)})
            impact["pos_balls_share"].append({"season": int(season), "group": grp, "value": r(posballs.loc[season, grp] / posballs.loc[season].sum() * 100)})

    # Run rate by wickets already lost, middle + death overs: do teams keep
    # swinging when they are 4 or 5 down?
    late = d[d.over >= 6].copy()
    late["wk_bucket"] = pd.cut(late.wickets_before, [-1, 1, 3, 5, 10], labels=["0–1 down", "2–3 down", "4–5 down", "6+ down"])
    late["era"] = late.season.map(era_of)
    lg = late.groupby(["era", "wk_bucket"], observed=True)
    impact["rr_by_wickets_down"] = [{"era": e, "bucket": b, "rr": r(v)} for (e, b), v in
                                    (lg.runs_total.sum() / lg.is_legal.sum() * 6).items()]
    # Same thing season by season for the "4–5 down" bucket
    sg = late[late.wk_bucket == "4–5 down"].groupby("season")
    impact["rr_4_5_down"] = [{"season": int(k), "value": r(v)} for k, v in (sg.runs_total.sum() / sg.is_legal.sum() * 6).items()]
    # How deep do innings go? Share of innings where a No. 8 walked out, and all out rate
    inn["no8_batted"] = (inn.batters_used >= 8).astype(int)
    inn["all_out"] = (inn.wickets >= 10).astype(int)
    ig = inn.groupby("season")
    impact["depth"] = [{"season": int(k), "no8_batted": r(x.no8_batted.mean() * 100), "all_out": r(x.all_out.mean() * 100),
                        "batters_used": r(x.batters_used.mean())} for k, x in ig]

    # Who comes in as the Impact Player?
    bat_in = d.groupby(["match_id", "batter"]).agg(balls=("is_legal", "sum"), runs=("runs_batter", "sum")).reset_index()
    bowl_in = d.groupby(["match_id", "bowler"]).agg(bowled=("is_legal", "sum"), wk=("bowler_wicket", "sum"), conceded=("runs_total", "sum")).reset_index()
    x = subs.merge(bat_in, left_on=["match_id", "player_in"], right_on=["match_id", "batter"], how="left")
    x = x.merge(bowl_in, left_on=["match_id", "player_in"], right_on=["match_id", "bowler"], how="left")
    x["batted"] = x.balls.notna()
    x["bowled_"] = x.bowled.notna()
    x["role"] = np.where(x.batted & x.bowled_, "Batted and bowled",
                np.where(x.batted, "Batted only", np.where(x.bowled_, "Bowled only", "Did neither")))
    # When does the team bring in the sub? Batting first team brings a bowler
    # in at the break; chasing team brings a batter in.
    x["when"] = np.where(x.innings == 1, "During 1st innings", "During 2nd innings")
    impact["sub_roles"] = records(x.groupby(["season", "role"]).size().rename("count").reset_index())
    impact["sub_runs_per_match"] = [{"season": int(k), "value": r(v)} for k, v in
                                    (x.groupby("season").runs.sum() / x.groupby("season").match_id.nunique()).items()]
    impact["sub_wickets_per_match"] = [{"season": int(k), "value": r(v)} for k, v in
                                       (x.groupby("season").wk.sum() / x.groupby("season").match_id.nunique()).items()]
    top = x.groupby("player_in").agg(times=("match_id", "size"), runs=("runs", "sum"), balls=("balls", "sum"), wk=("wk", "sum")).reset_index()
    top = top.sort_values("times", ascending=False).head(15)
    impact["top_subs"] = records(top.fillna(0))
    impact["n_subs"] = int(len(x))

    # Before/after: three seasons either side of the rule
    pre = [2020, 2021, 2022]
    post = [s_ for s_ in seasons if s_ >= IMPACT_SEASON]
    ss = s.set_index("season")
    metrics = [
        ("Avg 1st-innings total", "avg_first_innings"),
        ("Run rate", "run_rate"),
        ("Runs per wicket", "runs_per_wicket"),
        ("Sixes per match", "sixes_per_match"),
        ("Dot-ball %", "dot_pct"),
        ("Wickets per innings", "wickets_per_innings"),
        ("200+ first-innings totals %", "pct_200_plus"),
    ]
    impact["before_after"] = [{"metric": lbl, "before": r(ss.loc[pre, col].mean()), "after": r(ss.loc[post, col].mean()),
                               "change_pct": r((ss.loc[post, col].mean() / ss.loc[pre, col].mean() - 1) * 100, 1)}
                              for lbl, col in metrics]
    save("impact.json", impact)

    # ------------------------------------------------------------------
    # 8. Explorer data: teams, venues, players
    # ------------------------------------------------------------------
    # Team-season batting and bowling
    tb = d.groupby(["batting_team", "season"]).agg(runs=("runs_total", "sum"), balls=("is_legal", "sum"), wk=("wicket", "sum"),
                                                   sixes=("is_six", "sum"), fours=("is_four", "sum"), dots=("dot", "sum"),
                                                   m=("match_id", "nunique")).reset_index().rename(columns={"batting_team": "team"})
    tw = d.groupby(["bowling_team", "season"]).agg(runs_c=("runs_total", "sum"), balls_c=("is_legal", "sum"), wk_t=("wicket", "sum")).reset_index().rename(columns={"bowling_team": "team"})
    t = tb.merge(tw, on=["team", "season"])
    wins = m[m.winner.notna() & (m.winner != "")].groupby(["winner", "season"]).size().rename("wins").reset_index().rename(columns={"winner": "team"})
    t = t.merge(wins, on=["team", "season"], how="left").fillna({"wins": 0})
    ft = first.groupby(["batting_team", "season"]).runs.mean().rename("avg_first_innings").reset_index().rename(columns={"batting_team": "team"})
    t = t.merge(ft, on=["team", "season"], how="left")
    hi = inn.groupby(["batting_team", "season"]).runs.max().rename("highest").reset_index().rename(columns={"batting_team": "team"})
    t = t.merge(hi, on=["team", "season"], how="left")
    tp = d.groupby(["batting_team", "season", "phase"]).apply(lambda x: x.runs_total.sum() / x.is_legal.sum() * 6).unstack().reset_index().rename(columns={"batting_team": "team"})
    t = t.merge(tp, on=["team", "season"], how="left")
    t["run_rate"] = t.runs / t.balls * 6
    t["economy"] = t.runs_c / t.balls_c * 6
    t["sixes_per_match"] = t.sixes / t.m
    t["dot_pct"] = t.dots / t.balls * 100
    t["win_pct"] = t.wins / t.m * 100
    teams = t[["team", "season", "m", "wins", "win_pct", "run_rate", "economy", "avg_first_innings", "highest",
               "sixes_per_match", "dot_pct", "Powerplay", "Middle", "Death"]].rename(columns={"m": "matches"})
    save("explore_teams.json", records(teams))

    # Venue-season
    vg = d.groupby(["venue", "season"]).agg(runs=("runs_total", "sum"), balls=("is_legal", "sum"), wk=("wicket", "sum"),
                                           sixes=("is_six", "sum"), m=("match_id", "nunique")).reset_index()
    vf = first.groupby(["venue", "season"]).runs.mean().rename("avg_first_innings").reset_index()
    vg = vg.merge(vf, on=["venue", "season"], how="left")
    vbf = first.merge(m[["match_id"]], on="match_id").groupby(["venue", "season"]).won.mean().rename("bat_first_win_pct").reset_index()
    vg = vg.merge(vbf, on=["venue", "season"], how="left")
    vg["bat_first_win_pct"] *= 100
    vg["run_rate"] = vg.runs / vg.balls * 6
    vg["sixes_per_match"] = vg.sixes / vg.m
    vg["runs_per_wicket"] = vg.runs / vg.wk
    venues = vg[["venue", "season", "m", "run_rate", "avg_first_innings", "sixes_per_match", "runs_per_wicket", "bat_first_win_pct"]].rename(columns={"m": "matches"})
    save("explore_venues.json", records(venues))

    # Player-season batting
    lb = d.groupby(["batter", "season"]).agg(team=("batting_team", lambda x: x.mode().iat[0]), runs=("runs_batter", "sum"),
                                            balls=("is_legal", "sum"), fours=("is_four", "sum"), sixes=("is_six", "sum"),
                                            dots=("dot", "sum"), inns=("match_id", "nunique")).reset_index()
    outs = d[d.player_out.notna() & (d.wicket > 0)].copy()
    outs = outs.assign(player_out=outs.player_out.str.split(";")).explode("player_out")
    outs = outs[~outs.wicket_kind.fillna("").str.contains("retired hurt")]
    oc = outs.groupby(["player_out", "season"]).size().rename("outs").reset_index().rename(columns={"player_out": "batter"})
    lb = lb.merge(oc, on=["batter", "season"], how="left").fillna({"outs": 0})
    lb = lb[lb.balls > 0]
    lb = lb.rename(columns={"batter": "player"})
    save("explore_batting.json", {"columns": list(lb.columns), "rows": lb.values.tolist()})

    # Player-season bowling
    bw = d.copy()
    # Byes and leg byes are not charged to the bowler
    bw["conceded"] = bw.runs_batter + np.where(bw.is_wide + bw.is_noball > 0, bw.runs_extras, 0)
    lw = bw.groupby(["bowler", "season"]).agg(team=("bowling_team", lambda x: x.mode().iat[0]), balls=("is_legal", "sum"),
                                             conceded=("conceded", "sum"), wickets=("bowler_wicket", "sum"),
                                             dots=("dot", "sum"), sixes=("is_six", "sum"), inns=("match_id", "nunique")).reset_index()
    lw = lw[lw.balls > 0].rename(columns={"bowler": "player"})
    save("explore_bowling.json", {"columns": list(lw.columns), "rows": lw.values.tolist()})

    meta = {
        "seasons": [int(x) for x in seasons],
        "matches": int(len(m)),
        "deliveries": int(len(d)),
        "first_date": m.date.min(),
        "last_date": m.date.max(),
        "impact_season": IMPACT_SEASON,
        "eras": [e[0] for e in ERAS],
    }
    save("meta.json", meta)


if __name__ == "__main__":
    main()

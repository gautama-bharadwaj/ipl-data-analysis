import json
import csv
import os

# Function to extract required information from JSON
def extract_info(json_data, match_id):
    meta = json_data["meta"]
    info = json_data["info"]
    innings = json_data["innings"]
    outcome = info["outcome"]
    toss = info["toss"]

    if "winner" not in outcome:
        winner = outcome.get("result", "")
        result = ""
        result_margin = ""
    else:
        winner = outcome["winner"]
        result = "runs" if "runs" in outcome["by"] else "wickets"
        result_margin = outcome["by"].get("runs", outcome["by"].get("wickets"))

    if "match_number" in info["event"]:
        match_number = info["event"]["match_number"]
    else:
        match_number = info["event"]["stage"]
    return {
        "id": match_id,
        "match_number": match_number,
        "season": info["season"],
        "city": info.get("city", ""),
        "date": info["dates"][0],
        "match_type": info["match_type"],
        "player_of_match": ','.join(info.get("player_of_match", "")),
        "venue": info["venue"],
        "team1": info["teams"][0],
        "team2": info["teams"][1],
        "toss_winner": toss["winner"],
        "toss_decision": toss["decision"],
        "winner": winner,
        "result": result,
        "result_margin": result_margin,
        "target_runs": innings[1]["target"].get("runs", "") if len(innings) > 1 else "",
        "target_overs": innings[1]["target"].get("overs", "") if len(innings) > 1 else "",
        "super_over": "Yes" if "super_over" in info else "No",
        "method": "" if "method" not in outcome else outcome["method"],
        "umpire1": ','.join(info["officials"]["umpires"]),
        "umpire2": ','.join(info["officials"].get("tv_umpires", ""))
    }

# Directory containing JSON files
json_dir = "../dataset/ipl_json"
output_csv = "../dataset/csv/matches.csv"

# List to hold all extracted data
data = []

# Loop through each JSON file
for filename in os.listdir(json_dir):
    if filename.endswith(".json"):
        with open(os.path.join(json_dir, filename), "r") as file:
            json_data = json.load(file)
            print(filename)
            data.append(extract_info(json_data, int(filename[:-5])))

data.sort(key=lambda x: x["id"])

# Writing data to CSV
with open(output_csv, "w", newline="") as csvfile:
    fieldnames = [
        "id", "match_number", "season", "city", "date", "match_type", "player_of_match", "venue",
        "team1", "team2", "toss_winner", "toss_decision", "winner", "result",
        "result_margin", "target_runs", "target_overs", "super_over", "method",
        "umpire1", "umpire2"
    ]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    for match in data:
        writer.writerow(match)

print("CSV file created successfully.")

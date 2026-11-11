"""Download the latest IPL ball-by-ball archive from Cricsheet into dataset/ipl_json/.

Run from the repo root:  python scripts/fetch_data.py
Then rebuild:            python scripts/build_tables.py && python scripts/build_site_data.py
"""
import io
import os
import urllib.request
import zipfile

URL = "https://cricsheet.org/downloads/ipl_json.zip"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "dataset", "ipl_json")


def main():
    print(f"Downloading {URL} ...")
    req = urllib.request.Request(URL, headers={"User-Agent": "ipl-data-analysis"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        blob = resp.read()
    os.makedirs(DEST, exist_ok=True)
    n = 0
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        for name in zf.namelist():
            base = os.path.basename(name)
            if base.endswith(".json"):
                with open(os.path.join(DEST, base), "wb") as fh:
                    fh.write(zf.read(name))
                n += 1
            elif base == "README.txt":
                with open(os.path.join(DEST, "CRICSHEET_README.txt"), "wb") as fh:
                    fh.write(zf.read(name))
    print(f"Saved {n} match files to {os.path.relpath(DEST, ROOT)}")


if __name__ == "__main__":
    main()

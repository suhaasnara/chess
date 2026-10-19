#!/usr/bin/env python3
"""Save the PGN of every Lichess study chapter the site shows.

The site draws its game boards itself (from data/games/<chapter>.pgn) instead of
embedding lichess.org in an iframe, so boards load even when a visitor's network
is slow to reach Lichess, blocks it, or is rate-limited by it.

Which chapters to save is read from the pages: any data-game="XXXXXXXX"
attribute in index.html or blog/*.html. Run daily by
.github/workflows/update-games.yml, so edits to the study show up on the site
within a day. A file is only rewritten when the PGN changed.
"""
import glob
import os
import re
import sys
import time
import urllib.error
import urllib.request

STUDY = "oAqAo3ZN"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "games")
URL = ("https://lichess.org/api/study/{study}/{chapter}.pgn"
       "?clocks=true&comments=true&variations=true&orientation=true")


def chapters():
    pages = [os.path.join(ROOT, "index.html")] + glob.glob(os.path.join(ROOT, "blog", "*.html"))
    found = []
    for page in pages:
        with open(page, encoding="utf-8") as f:
            for ch in re.findall(r'data-game="([A-Za-z0-9]{8})"', f.read()):
                if ch not in found:
                    found.append(ch)
    return found


def fetch(chapter):
    req = urllib.request.Request(
        URL.format(study=STUDY, chapter=chapter),
        headers={"User-Agent": "suhaasnarayanan.com game sync (github.com/suhaasnara/chess)"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(65)  # Lichess asks clients to wait a minute after a 429
                continue
            raise


def main():
    os.makedirs(OUT, exist_ok=True)
    chs = chapters()
    if not chs:
        sys.exit("No data-game chapters found in the pages.")
    failed = []
    for ch in chs:
        try:
            pgn = fetch(ch).strip() + "\n"
        except Exception as e:  # keep the last good copy if Lichess is down
            print(f"{ch}: fetch failed ({e}); keeping existing file")
            failed.append(ch)
            continue
        if not pgn.startswith("["):
            print(f"{ch}: unexpected response; keeping existing file")
            failed.append(ch)
            continue
        path = os.path.join(OUT, ch + ".pgn")
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old != pgn:
            with open(path, "w", encoding="utf-8") as f:
                f.write(pgn)
            print(f"{ch}: updated")
        else:
            print(f"{ch}: unchanged")
        time.sleep(1.5)
    # A chapter with no saved copy at all would leave a broken board, so fail loudly.
    missing = [c for c in failed if not os.path.exists(os.path.join(OUT, c + ".pgn"))]
    if missing:
        sys.exit("Missing PGNs: " + ", ".join(missing))


if __name__ == "__main__":
    main()

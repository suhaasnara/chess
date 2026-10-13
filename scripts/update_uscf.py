"""Refresh data/uscf-history.json from the public US Chess ratings API.

Run by .github/workflows/update-ratings.yml. Rating numbers always come from
US Chess. Event names already in the file are kept (they were tidied by hand);
new events get their all-caps names title-cased. The "Career high" milestone
moves if a new high is set. The file is only rewritten when something changed,
plus a monthly touch of "pulled" so GitHub keeps the schedule active.
"""
import json, re, sys, urllib.request
from datetime import date, datetime
from pathlib import Path

MEMBER = "14290675"
API = f"https://ratings-api.uschess.org/api/v1/members/{MEMBER}/sections?offset={{off}}&size=100"
FILE = Path(__file__).resolve().parent.parent / "data" / "uscf-history.json"
ACRONYMS = {"DCC", "FCCC", "CSCA", "SJIC", "PSD", "CSU", "US", "USCF", "MLK", "WO", "CO", "DCSC", "II", "III", "IV"}
SMALL = {"of", "the", "and", "to", "at", "vs", "in", "for", "a"}


def fetch_sections():
    items, off = [], 0
    while True:
        req = urllib.request.Request(API.format(off=off), headers={
            "User-Agent": "suhaasnarayanan.com rating chart (GitHub Actions)",
            "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            page = json.load(r)
        items += page.get("items", [])
        if not page.get("hasNextPage"):
            return items
        off += 100
        if off > 5000:
            sys.exit("Too many pages; stopping.")


def tidy(name):
    """Title-case an all-caps event name, keeping known acronyms and ordinals."""
    if re.search(r"[a-z]", name):
        return name
    out = []
    for i, w in enumerate(name.split()):
        if w in ACRONYMS or re.fullmatch(r"[A-Z]-?\d+", w) or re.fullmatch(r"G[/-]?\d+", w) or re.fullmatch(r"K-\d+", w):
            out.append(w)
        elif re.fullmatch(r"\d+(ST|ND|RD|TH)", w):
            out.append(w.lower())
        elif w.lower() in SMALL and i:
            out.append(w.lower())
        elif w == "UPENN":
            out.append("UPenn")
        else:
            out.append(w[0] + w[1:].lower())
    return " ".join(out)


def main():
    old = json.loads(FILE.read_text())
    items = list(reversed(fetch_sections()))  # API is newest first
    if len(items) < len(old["rows"]) * 0.9:
        sys.exit(f"API returned {len(items)} sections vs {len(old['rows'])} on file; not trusting it.")

    # Keep hand-tidied names: match by date, state, and position among same-date rows.
    names = {}
    seen = {}
    for r in old["rows"]:
        k = (r["d"], r["s"]); seen[k] = seen.get(k, 0) + 1
        names[k + (seen[k],)] = r["e"]
    rows, seen = [], {}
    for it in items:
        rec = {x["ratingSource"]: x["postRating"] for x in it.get("ratingRecords", [])}
        if not any(s in rec for s in "RQB"):
            continue
        ev = it.get("event") or {}
        d, s = it["endDate"], ev.get("stateCode")
        k = (d, s); seen[k] = seen.get(k, 0) + 1
        rows.append({"d": d, "e": names.get(k + (seen[k],), tidy(ev.get("name", "").strip())), "s": s,
                     "r": rec.get("R"), "q": rec.get("Q"), "b": rec.get("B")})

    last = lambda key: next((r[key] for r in reversed(rows) if r[key] is not None), None)
    new = dict(old)
    new["rows"] = rows
    new["asOf"] = rows[-1]["d"]
    new["current"] = {"r": last("r"), "q": last("q"), "b": last("b")}
    reg = [r for r in rows if r["r"] is not None]
    peak = max(reg, key=lambda r: r["r"])  # max() keeps the first date the peak was reached
    new["milestones"] = [dict(m, d=peak["d"]) if m.get("label") == "Career high" else m for m in old["milestones"]]

    changed = any(new[k] != old[k] for k in ("rows", "asOf", "current", "milestones"))
    stale = (date.today() - datetime.strptime(old.get("pulled", "2000-01-01"), "%Y-%m-%d").date()).days >= 30
    if not changed and not stale:
        print(f"No new results ({len(rows)} sections, latest {new['asOf']}).")
        return
    new["pulled"] = date.today().isoformat()
    FILE.write_text(json.dumps(new, ensure_ascii=False, separators=(",", ":")))
    added = len(rows) - len(old["rows"])
    print(f"Updated: {len(rows)} sections ({added:+d}), latest {new['asOf']}, current {new['current']}.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Print tables from an arXiv (LaTeXML) HTML page whose caption matches a regex.

Usage:
  extract_tables.py <arxiv-id-or-url> <caption-regex> [--rows REGEX] [--csv OUT]

Examples:
  extract_tables.py 2503.10497 "^Table 3" --rows "English|Czech|Russian"
  extract_tables.py 2412.00559v2 "^Table 4" --csv RAW-2412.00559-table4.csv
"""
import argparse
import csv
import re
import sys
import urllib.request
from html.parser import HTMLParser


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []  # list of (caption, rows)
        self._depth = 0   # nesting depth inside a figure.ltx_table
        self._cap = None
        self._rows = None
        self._row = None
        self._cell = None
        self._in_cap = False

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class", "") or ""
        if tag == "figure" and "ltx_table" in cls.split():
            if self._depth == 0:
                self._cap, self._rows = [], []
            self._depth += 1
            return
        if self._depth == 0:
            return
        if tag == "figure":
            self._depth += 1
        elif tag == "figcaption":
            self._in_cap = True
        elif tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if self._depth == 0:
            return
        if tag == "figure":
            self._depth -= 1
            if self._depth == 0:
                cap = re.sub(r"\s+", " ", "".join(self._cap)).strip()
                self.tables.append((cap, self._rows))
        elif tag == "figcaption":
            self._in_cap = False
        elif tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if any(self._row):
                self._rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._depth == 0:
            return
        if self._in_cap:
            self._cap.append(data)
        elif self._cell is not None:
            self._cell.append(data)


def to_url(ref):
    if ref.startswith("http"):
        return ref
    return f"https://arxiv.org/html/{ref}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref", help="arXiv id (e.g. 2503.10497 or 2412.00559v2) or full URL")
    ap.add_argument("caption", help="regex matched against the table caption, e.g. '^Table 4'")
    ap.add_argument("--rows", help="keep only rows whose first cell matches this regex (header rows kept)")
    ap.add_argument("--csv", help="write the matched table(s) to this CSV file")
    args = ap.parse_args()

    url = to_url(args.ref)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (research table extractor)"})
    try:
        html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    except Exception as e:  # network blocked, 404 (no HTML version) etc.
        sys.exit(f"Could not fetch {url}: {e}. Try another version (v1/v2), ar5iv.labs.arxiv.org/html/<id>, or the browser DOM snippet.")

    p = TableParser()
    p.feed(html)
    cap_re = re.compile(args.caption)
    row_re = re.compile(args.rows) if args.rows else None
    matched = [(c, r) for c, r in p.tables if cap_re.search(c)]
    if not matched:
        caps = "\n".join("  " + c[:100] for c, _ in p.tables)
        sys.exit(f"No table caption matches {args.caption!r} in {url}. Captions found:\n{caps}")

    out_rows = []
    for cap, rows in matched:
        print(f"# {url}\n# {cap}")
        for i, row in enumerate(rows):
            header_like = i < 2 and not any(re.fullmatch(r"[-+−]?\d+([.,]\d+)?%?", c) for c in row[1:] if c)
            if row_re and not header_like and not row_re.search(row[0]):
                continue
            print(" | ".join(row))
            out_rows.append(row)
        print()

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            f.write(f"# Source: {url}; caption: {matched[0][0][:200]}\n")
            csv.writer(f).writerows(out_rows)
        print(f"Wrote {len(out_rows)} rows to {args.csv}")


if __name__ == "__main__":
    main()

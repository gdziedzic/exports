#!/usr/bin/env python3
"""Ingest Confluence pages into raw/ as markdown.

Config (powledge.config.json → confluence):
  base_url            - https://mycompany.atlassian.net/wiki
  email               - Atlassian account email
  space_keys          - list of space keys to ingest
  page_ids            - list of specific page IDs to ingest
  include_child_pages - follow child pages recursively (default: true)
  exclude_labels      - skip pages with these labels
  page_limit          - max pages per space fetch (default: 100)

Auth:
  Set CONFLUENCE_API_TOKEN env var to your Atlassian API token.
  Generate one at: https://id.atlassian.com/manage-profile/security/api-tokens

Usage:
  python ingest/confluence.py                            # ingest all configured spaces/pages
  python ingest/confluence.py --page-id 12345            # single page
  python ingest/confluence.py --page-id 111 222 333      # multiple pages
  python ingest/confluence.py --space-key ENG            # single space
  python ingest/confluence.py --space-key ENG HR         # multiple spaces
  python ingest/confluence.py --dry-run                  # list pages without writing

Windows (PowerShell):
  $env:CONFLUENCE_API_TOKEN = "your_token"
  $env:CONFLUENCE_BASE_URL  = "https://mycompany.atlassian.net/wiki"  # or set in config
  $env:CONFLUENCE_EMAIL     = "you@company.com"                       # or set in config
  python ingest/confluence.py --page-id 111 222 333

Windows (cmd):
  set CONFLUENCE_API_TOKEN=your_token
  python ingest/confluence.py --page-id 111 222 333

Persistent env vars (PowerShell, survives restarts):
  [System.Environment]::SetEnvironmentVariable("CONFLUENCE_API_TOKEN", "your_token", "User")
"""

import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import ensure_dirs, load_config, raw_dir


# ---------------------------------------------------------------------------
# Confluence storage format → Markdown
# ---------------------------------------------------------------------------

class _StorageToMarkdown(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.tag_stack = []        # (tag, attrs_dict)
        self.list_stack = []       # ('ul'|'ol', counter)
        self.skip_depth = 0

        # code macro state
        self.in_code_macro = False
        self.in_param_lang = False
        self.code_lang = ""
        self.code_parts = []

        # table state
        self.in_table = False
        self.table_has_header = False
        self.current_row_cells = None  # list of str when inside <tr>
        self.current_cell_parts = None # list of str when inside <td>/<th>
        self.is_th = False

    # -- helpers -------------------------------------------------------------

    def _tags(self):
        return [t for t, _ in self.tag_stack]

    def _ensure_blank_line(self):
        text = "".join(self.parts)
        if not text.endswith("\n\n"):
            if text.endswith("\n"):
                self.parts.append("\n")
            else:
                self.parts.append("\n\n")

    def _write(self, s):
        if self.current_cell_parts is not None:
            self.current_cell_parts.append(s)
        else:
            self.parts.append(s)

    # -- HTMLParser overrides ------------------------------------------------

    def handle_starttag(self, tag, attrs):
        if self.skip_depth > 0:
            self.skip_depth += 1
            return

        attrs_dict = dict(attrs)
        self.tag_stack.append((tag, attrs_dict))

        # --- skip tags whose content we don't want ---
        if tag in ("ac:image", "ac:emoticon", "ac:task-list", "ac:task",
                   "ac:placeholder", "ac:inline-comment-marker"):
            self.skip_depth = 1
            return

        # --- block elements ---
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._ensure_blank_line()
            self._write("#" * int(tag[1]) + " ")

        elif tag == "p":
            self._ensure_blank_line()

        elif tag == "br":
            self._write("  \n")

        elif tag == "hr":
            self._ensure_blank_line()
            self._write("---\n\n")

        elif tag == "blockquote":
            self._ensure_blank_line()
            self._write("> ")

        # --- inline formatting ---
        elif tag in ("strong", "b"):
            self._write("**")

        elif tag in ("em", "i"):
            self._write("*")

        elif tag in ("s", "del", "strike"):
            self._write("~~")

        elif tag == "code" and "pre" not in self._tags():
            self._write("`")

        elif tag == "pre":
            self._ensure_blank_line()
            self._write("```\n")

        # --- links ---
        elif tag == "a":
            href = attrs_dict.get("href", "")
            self._write("[")
            self.tag_stack[-1] = (tag, {**attrs_dict, "_href": href})

        # --- lists ---
        elif tag == "ul":
            self.list_stack.append(["ul", 0])
            self._ensure_blank_line()

        elif tag == "ol":
            self.list_stack.append(["ol", 0])
            self._ensure_blank_line()

        elif tag == "li":
            text = "".join(self.parts)
            if not text.endswith("\n"):
                self._write("\n")
            if self.list_stack:
                kind, count = self.list_stack[-1]
                indent = "  " * (len(self.list_stack) - 1)
                if kind == "ul":
                    self._write(f"{indent}- ")
                else:
                    self.list_stack[-1][1] = count + 1
                    self._write(f"{indent}{count + 1}. ")

        # --- tables ---
        elif tag == "table":
            self._ensure_blank_line()
            self.in_table = True
            self.table_has_header = False

        elif tag == "tr":
            self.current_row_cells = []

        elif tag in ("th", "td"):
            self.current_cell_parts = []
            self.is_th = tag == "th"

        # --- Confluence macros ---
        elif tag == "ac:structured-macro":
            name = attrs_dict.get("ac:name", "")
            if name == "code":
                self.in_code_macro = True
                self.code_lang = ""
                self.code_parts = []

        elif tag == "ac:parameter":
            if self.in_code_macro and attrs_dict.get("ac:name") == "language":
                self.in_param_lang = True

    def handle_endtag(self, tag):
        if self.skip_depth > 0:
            self.skip_depth -= 1
            return

        # pop safely
        attrs_dict = {}
        for i in range(len(self.tag_stack) - 1, -1, -1):
            if self.tag_stack[i][0] == tag:
                _, attrs_dict = self.tag_stack.pop(i)
                break

        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._write("\n\n")

        elif tag == "p":
            self._write("\n\n")

        elif tag == "blockquote":
            self._write("\n\n")

        elif tag in ("strong", "b"):
            self._write("**")

        elif tag in ("em", "i"):
            self._write("*")

        elif tag in ("s", "del", "strike"):
            self._write("~~")

        elif tag == "code" and "pre" not in self._tags():
            self._write("`")

        elif tag == "pre":
            text = "".join(self.parts)
            if not text.endswith("\n"):
                self._write("\n")
            self._write("```\n\n")

        elif tag == "a":
            href = attrs_dict.get("_href", attrs_dict.get("href", ""))
            self._write(f"]({href})")

        elif tag in ("ul", "ol"):
            if self.list_stack:
                self.list_stack.pop()
            self._write("\n")

        elif tag == "li":
            self._write("\n")

        elif tag in ("th", "td"):
            cell_text = "".join(self.current_cell_parts or []).replace("\n", " ").strip()
            if self.current_row_cells is not None:
                self.current_row_cells.append(cell_text)
            self.current_cell_parts = None

        elif tag == "tr":
            if self.current_row_cells is not None:
                cells = self.current_row_cells
                row = "| " + " | ".join(cells) + " |"
                self.parts.append(row + "\n")
                if not self.table_has_header:
                    sep = "| " + " | ".join(["---"] * len(cells)) + " |"
                    self.parts.append(sep + "\n")
                    self.table_has_header = True
            self.current_row_cells = None

        elif tag == "table":
            self.in_table = False
            self.parts.append("\n")

        elif tag == "ac:structured-macro":
            if self.in_code_macro:
                lang = self.code_lang
                body = "".join(self.code_parts).strip()
                self._ensure_blank_line()
                self.parts.append(f"```{lang}\n{body}\n```\n\n")
                self.in_code_macro = False
                self.code_parts = []

        elif tag == "ac:parameter":
            self.in_param_lang = False

    def handle_data(self, data):
        if self.skip_depth > 0:
            return

        if self.in_param_lang:
            self.code_lang = data.strip()
            return

        if self.in_code_macro and "ac:parameter" not in self._tags():
            self.code_parts.append(data)
            return

        self._write(data)

    def result(self) -> str:
        md = "".join(self.parts)
        md = re.sub(r"\n{3,}", "\n\n", md)
        return md.strip()


def storage_to_markdown(html: str) -> str:
    parser = _StorageToMarkdown()
    parser.feed(html)
    return parser.result()


# ---------------------------------------------------------------------------
# Confluence API client (urllib only)
# ---------------------------------------------------------------------------

class ConfluenceClient:
    def __init__(self, base_url: str, email: str, token: str):
        self.base_url = base_url.rstrip("/")
        self._auth = base64.b64encode(f"{email}:{token}".encode()).decode()

    def _get(self, path: str, params: dict = None) -> dict:
        url = f"{self.base_url}/rest/api{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={
            "Authorization": f"Basic {self._auth}",
            "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            raise RuntimeError(f"Confluence API {e.code} for {url}: {body}") from e

    def get_page(self, page_id: str) -> dict:
        return self._get(
            f"/content/{page_id}",
            {"expand": "body.storage,space,ancestors,metadata.labels,version"},
        )

    def get_space_pages(self, space_key: str, limit: int = 100) -> list[dict]:
        pages = []
        start = 0
        while True:
            data = self._get("/content", {
                "spaceKey": space_key,
                "type": "page",
                "status": "current",
                "expand": "body.storage,space,metadata.labels,version",
                "limit": limit,
                "start": start,
            })
            results = data.get("results", [])
            pages.extend(results)
            if data.get("_links", {}).get("next"):
                start += len(results)
            else:
                break
        return pages

    def get_child_pages(self, page_id: str) -> list[dict]:
        pages = []
        start = 0
        while True:
            data = self._get(f"/content/{page_id}/child/page", {
                "expand": "body.storage,space,metadata.labels,version",
                "limit": 50,
                "start": start,
            })
            results = data.get("results", [])
            pages.extend(results)
            if data.get("_links", {}).get("next"):
                start += len(results)
            else:
                break
        return pages

    def collect_page_tree(self, page_id: str, include_children: bool) -> list[dict]:
        root = self.get_page(page_id)
        pages = [root]
        if include_children:
            for child in self.get_child_pages(page_id):
                pages.extend(self.collect_page_tree(child["id"], include_children=True))
        return pages


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _page_labels(page: dict) -> list[str]:
    try:
        return [l["name"] for l in page["metadata"]["labels"]["results"]]
    except (KeyError, TypeError):
        return []


def _page_url(base_url: str, page: dict) -> str:
    try:
        web_ui = page["_links"]["webui"]
        return base_url + web_ui
    except KeyError:
        return ""


def _slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]


def _already_ingested(raw: Path, source_url: str) -> bool:
    for meta_file in raw.glob("*.meta.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            if meta.get("source_url") == source_url:
                return True
        except (json.JSONDecodeError, OSError):
            pass
    return False


# ---------------------------------------------------------------------------
# Core write
# ---------------------------------------------------------------------------

def write_page(page: dict, raw: Path, base_url: str, dedup: bool) -> str | None:
    """Convert one Confluence page and write to raw/. Returns file path or None if skipped."""
    page_id = page["id"]
    title = page.get("title", page_id)
    source_url = _page_url(base_url, page)

    if dedup and source_url and _already_ingested(raw, source_url):
        return None

    storage_html = page.get("body", {}).get("storage", {}).get("value", "")
    markdown = storage_to_markdown(storage_html)

    space_key = page.get("space", {}).get("key", "")
    labels = _page_labels(page)
    version = page.get("version", {}).get("number", 1)
    modified = page.get("version", {}).get("when", "")

    slug = _slug(title)
    filename = f"confluence-{page_id}-{slug}"
    md_path = raw / f"{filename}.md"
    meta_path = raw / f"{filename}.meta.json"

    frontmatter = "\n".join([
        "---",
        f"id: {filename}",
        f"title: \"{title}\"",
        f"source: \"{source_url}\"",
        f"date: {modified[:10] if modified else datetime.now(timezone.utc).date().isoformat()}",
        f"tags: {json.dumps(labels)}",
        f"type: confluence-page",
        "---",
        "",
    ])

    md_path.write_text(frontmatter + "\n# " + title + "\n\n" + markdown, encoding="utf-8")
    meta_path.write_text(json.dumps({
        "id": filename,
        "confluence_id": page_id,
        "title": title,
        "source_url": source_url,
        "space_key": space_key,
        "labels": labels,
        "version": version,
        "modified": modified,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "raw_file": md_path.name,
        "type": "confluence-page",
    }, indent=2), encoding="utf-8")

    return str(md_path)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Ingest Confluence pages into raw/")
    parser.add_argument("--page-id", nargs="+", metavar="ID", help="One or more page IDs to ingest")
    parser.add_argument("--space-key", nargs="+", metavar="KEY", help="One or more space keys to ingest")
    parser.add_argument("--dry-run", action="store_true", help="List pages without writing")
    args = parser.parse_args()

    config = load_config()
    cf_cfg = config.get("confluence", {})

    base_url = cf_cfg.get("base_url") or os.environ.get("CONFLUENCE_BASE_URL")
    email = cf_cfg.get("email") or os.environ.get("CONFLUENCE_EMAIL")
    token = os.environ.get("CONFLUENCE_API_TOKEN")

    if not base_url:
        sys.exit("Error: confluence.base_url not set in config or CONFLUENCE_BASE_URL env var")
    if not email:
        sys.exit("Error: confluence.email not set in config or CONFLUENCE_EMAIL env var")
    if not token:
        sys.exit("Error: CONFLUENCE_API_TOKEN env var not set")

    ensure_dirs(config)
    raw = raw_dir(config)
    dedup = config.get("ingest", {}).get("dedup_by") == "source_url"
    include_children = cf_cfg.get("include_child_pages", True)
    exclude_labels = set(cf_cfg.get("exclude_labels", []))
    page_limit = cf_cfg.get("page_limit", 100)

    client = ConfluenceClient(base_url, email, token)

    # Collect pages to process
    pages: list[dict] = []

    page_ids = list(args.page_id or []) + ([] if args.page_id else cf_cfg.get("page_ids", []))
    space_keys = list(args.space_key or []) + ([] if args.space_key else cf_cfg.get("space_keys", []))

    for pid in page_ids:
        pages.extend(client.collect_page_tree(pid, include_children))
    for sk in space_keys:
        pages.extend(client.get_space_pages(sk, limit=page_limit))

    if not pages:
        print("No pages found. Check config or pass --page-id / --space-key.")
        return

    # Filter excluded labels
    if exclude_labels:
        before = len(pages)
        pages = [p for p in pages if not (exclude_labels & set(_page_labels(p)))]
        skipped = before - len(pages)
        if skipped:
            print(f"Skipped {skipped} pages with excluded labels.")

    if args.dry_run:
        print(f"{'ID':<12} {'Space':<8} Title")
        print("-" * 60)
        for p in pages:
            space = p.get("space", {}).get("key", "")
            print(f"{p['id']:<12} {space:<8} {p.get('title', '')}")
        print(f"\nTotal: {len(pages)} pages")
        return

    written = 0
    skipped = 0
    for page in pages:
        result = write_page(page, raw, base_url, dedup)
        if result:
            print(f"  + {page.get('title', page['id'])}")
            written += 1
        else:
            print(f"  ~ {page.get('title', page['id'])} (skipped, already ingested)")
            skipped += 1

    print(f"\nDone: {written} written, {skipped} skipped.")


if __name__ == "__main__":
    main()

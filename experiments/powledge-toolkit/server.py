#!/usr/bin/env python3
"""Powledge Toolkit — Web UI Server

Usage:
    python server.py          # http://127.0.0.1:7700
    python server.py 8080     # custom port
"""

import json
import re
import shutil
import subprocess
import sys
import time
from datetime import date, datetime
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
from config import get_dir, load_config

DEFAULT_PORT = 7700
HOST = "127.0.0.1"


# ── helpers ───────────────────────────────────────────────────────────────────

SNIPPET_CONTEXT = 80  # chars of context before/after a body match


def run(script, args=(), timeout=120):
    cmd = [sys.executable, str(ROOT / script), *args]
    try:
        return subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), timeout=timeout)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, 1, "", "timeout")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def parse_frontmatter(content):
    if not content.startswith("---"):
        return {}, content
    end = content.find("\n---", 3)
    if end == -1:
        return {}, content
    body = content[end + 4:].lstrip("\n")
    fm = {}
    for line in content[3:end].strip().splitlines():
        if ": " in line:
            k, _, v = line.partition(": ")
            v = v.strip()
            if v.startswith('"') and v.endswith('"'):
                v = v[1:-1]
            elif v.startswith("["):
                try:
                    v = json.loads(v)
                except Exception:
                    pass
            fm[k.strip()] = v
    return fm, body


def _extract_snippet(root, knowledge_file, query):
    """Return a plain-text excerpt around the first occurrence of *query* in
    the body of *knowledge_file*, or None if not found or file unreadable."""
    if not knowledge_file or not query:
        return None
    path = Path(knowledge_file)
    if not path.is_absolute():
        path = root / path
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    _, body = parse_frontmatter(raw)
    low = body.lower()
    idx = low.find(query)
    if idx == -1:
        return None
    start = max(0, idx - SNIPPET_CONTEXT)
    end   = min(len(body), idx + len(query) + SNIPPET_CONTEXT)
    chunk = body[start:end].replace("\n", " ")
    if start > 0:
        chunk = "…" + chunk
    if end < len(body):
        chunk = chunk + "…"
    return chunk


def build_frontmatter(fm):
    lines = ["---"]
    for k, v in fm.items():
        if isinstance(v, list):
            lines.append(f"{k}: {json.dumps(v)}")
        elif isinstance(v, str) and any(c in v for c in ':"{}[]'):
            lines.append(f'{k}: "{v}"')
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines)


def _fetch_url(url, timeout=15):
    """Fetch a URL and return raw HTML bytes. Raises on non-HTML or errors."""
    import urllib.request as _ur
    req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; Powledge/1.0)"})
    with _ur.urlopen(req, timeout=timeout) as resp:
        ct = resp.headers.get("Content-Type", "")
        if "text/html" not in ct and "text/plain" not in ct:
            raise ValueError(f"Unsupported content type: {ct}")
        return resp.read(4 * 1024 * 1024)


def _html_to_markdown(html_bytes):
    """Return (markdown_text, page_title) from raw HTML bytes using stdlib only."""

    class _P(HTMLParser):
        SKIP  = frozenset(["script","style","nav","footer","header","aside","noscript","iframe","form"])
        BLOCK = frozenset(["p","div","section","article","main","blockquote","figure","figcaption"])

        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.buf, self.title = [], ""
            self._skip, self._in_title, self._pending = 0, False, 0

        def _want(self, n):
            self._pending = max(self._pending, n)

        def _flush(self):
            if self._pending and self.buf:
                have = len(self.buf[-1]) - len(self.buf[-1].rstrip("\n"))
                need = self._pending - have
                if need > 0:
                    self.buf.append("\n" * need)
            self._pending = 0

        def handle_starttag(self, tag, attrs):
            t = tag.lower()
            if t in self.SKIP:       self._skip += 1;  return
            if self._skip:            return
            if t == "title":          self._in_title = True; return
            if t == "br":             self.buf.append("\n"); return
            m = re.match(r"^h([1-6])$", t)
            if m:
                self._want(2); self._flush()
                self.buf.append("#" * int(m.group(1)) + " "); return
            if t in self.BLOCK:       self._want(2); return
            if t == "li":             self._want(1); self._flush(); self.buf.append("- "); return
            if t == "pre":            self._want(2); self._flush(); self.buf.append("```\n"); return
            if t == "code":           self.buf.append("`"); return
            if t in ("strong", "b"): self.buf.append("**"); return
            if t in ("em", "i"):     self.buf.append("*"); return

        def handle_endtag(self, tag):
            t = tag.lower()
            if t in self.SKIP:        self._skip = max(0, self._skip - 1); return
            if self._skip:             return
            if t == "title":           self._in_title = False; return
            if re.match(r"^h([1-6])$", t): self._want(2); return
            if t in self.BLOCK:        self._want(2); return
            if t in ("ul","ol","li"):  self._want(1); return
            if t == "pre":             self.buf.append("\n```"); self._want(2); return
            if t == "code":            self.buf.append("`"); return
            if t in ("strong", "b"):  self.buf.append("**"); return
            if t in ("em", "i"):      self.buf.append("*"); return

        def handle_data(self, data):
            if self._skip: return
            if self._in_title: self.title += data; return
            text = re.sub(r"[ \t]+", " ", data)
            if text.strip():
                self._flush()
                self.buf.append(text)

    try:
        html = html_bytes.decode("utf-8", errors="replace")
    except Exception:
        html = ""
    p = _P()
    p.feed(html)
    raw = "".join(p.buf)
    raw = re.sub(r"\n{3,}", "\n\n", raw).strip()
    return raw, p.title.strip()


CONFIG_DEFAULTS = {
    "ui": {
        "backup_on_update": True,
        "max_backups_per_entry": 10,
        "max_content_bytes": 1_048_576,
        "require_title": True,
        "default_type": "manual",
        "default_tags": [],
    }
}


def validate_id(entry_id):
    if not entry_id:
        raise ValueError("ID cannot be empty")
    if ".." in entry_id or "/" in entry_id or "\\" in entry_id or "\0" in entry_id:
        raise ValueError("ID contains invalid characters")
    if len(entry_id) > 200:
        raise ValueError("ID too long (max 200 characters)")


def get_ui_cfg(cfg):
    base = dict(CONFIG_DEFAULTS["ui"])
    base.update(cfg.get("ui", {}))
    return base


def create_backup(kd, entry_id, content, max_keep=10):
    backup_dir = kd / "backups" / entry_id
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%dT%H%M%S")
    (backup_dir / f"{ts}.md").write_text(content, encoding="utf-8")
    if max_keep > 0:
        existing = sorted(backup_dir.glob("*.md"))
        for old in existing[:-max_keep]:
            old.unlink()


# ── request handler ───────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # silence noisy default

    def cfg(self):
        return load_config()

    # wire helpers

    def json_out(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def err(self, msg, status=400):
        self.json_out({"error": msg}, status)

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n).decode() if n else ""
        return json.loads(raw) if raw else {}

    def static(self, path):
        import mimetypes
        p = Path(path)
        if not p.exists():
            self.send_error(404)
            return
        data = p.read_bytes()
        mime, _ = mimetypes.guess_type(str(p))
        self.send_response(200)
        self.send_header("Content-Type", mime or "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # routing

    def do_GET(self):
        pr = urlparse(self.path)
        p, qs = pr.path, parse_qs(pr.query)
        if p in ("/", "/index.html"):
            self.static(ROOT / "ui" / "index.html")
        elif p.startswith("/api/"):
            self.handle_get(p[5:], qs)
        else:
            self.send_error(404)

    def do_POST(self):
        p = urlparse(self.path).path
        if p.startswith("/api/"):
            self.handle_post(p[5:], self.body())
        else:
            self.send_error(404)

    def do_PUT(self):
        p = urlparse(self.path).path
        if p.startswith("/api/"):
            self.handle_put(p[5:], self.body())
        else:
            self.send_error(404)

    def do_DELETE(self):
        p = urlparse(self.path).path
        if p.startswith("/api/"):
            self.handle_delete(p[5:])
        else:
            self.send_error(404)

    # GET

    def handle_get(self, path, qs):
        cfg = self.cfg()
        kd = get_dir(cfg, "knowledge")
        id_ = get_dir(cfg, "index")
        rd  = get_dir(cfg, "raw")

        if path == "index":
            f = id_ / "all.json"
            self.json_out(json.loads(f.read_text("utf-8")) if f.exists() else {"entries": [], "count": 0})

        elif path == "status":
            arch = kd / "archived"
            self.json_out({
                "knowledge": len(list(kd.glob("*.md"))) if kd.exists() else 0,
                "archived":  len(list(arch.glob("*.md"))) if arch.exists() else 0,
                "raw":       len(list(rd.glob("*.md"))) if rd.exists() else 0,
                "index":     len(list(id_.glob("*.index.json"))) if id_.exists() else 0,
            })

        elif path == "config":
            f = ROOT / "powledge.config.json"
            self.json_out(json.loads(f.read_text("utf-8")) if f.exists() else {})

        elif path == "tags":
            f = id_ / "all.json"
            if not f.exists():
                return self.json_out([])
            counts: dict = {}
            for e in json.loads(f.read_text("utf-8")).get("entries", []):
                for t in e.get("tags", []):
                    counts[t] = counts.get(t, 0) + 1
            self.json_out(sorted(counts.items(), key=lambda x: -x[1]))

        elif path == "stats":
            from datetime import timedelta
            f = id_ / "all.json"
            entries = json.loads(f.read_text("utf-8")).get("entries", []) if f.exists() else []

            today = date.today()
            week_ago  = today - timedelta(days=7)
            month_ago = today - timedelta(days=30)

            total_words = 0
            total_size  = 0
            entries_with_tags      = 0
            entries_with_summaries = 0
            entries_stale          = 0
            types: dict = {}
            entries_this_week  = 0
            entries_this_month = 0
            dates = []

            for e in entries:
                if e.get("tags"):
                    entries_with_tags += 1
                if (e.get("summary") or "").strip():
                    entries_with_summaries += 1

                d = e.get("date", "")
                if d:
                    try:
                        ed = date.fromisoformat(d)
                        dates.append(d)
                        if ed >= week_ago:
                            entries_this_week += 1
                        if ed >= month_ago:
                            entries_this_month += 1
                    except ValueError:
                        pass

                idx_file = id_ / f"{e['id']}.index.json"
                if idx_file.exists():
                    try:
                        if json.loads(idx_file.read_text("utf-8")).get("summary_stale"):
                            entries_stale += 1
                    except Exception:
                        pass

                kf_rel = e.get("knowledge_file", "")
                if kf_rel:
                    kf = ROOT / kf_rel
                    if kf.exists():
                        try:
                            raw = kf.read_text("utf-8")
                            total_size += kf.stat().st_size
                            fm, body = parse_frontmatter(raw)
                            t = fm.get("type", "unknown")
                            types[t] = types.get(t, 0) + 1
                            total_words += len(body.split())
                        except Exception:
                            pass

            backup_count = 0
            backup_dir = kd / "backups"
            if backup_dir.exists():
                backup_count = sum(1 for _ in backup_dir.rglob("*.md"))

            n = len(entries)
            self.json_out({
                "total_words":            total_words,
                "avg_words":              round(total_words / n) if n else 0,
                "total_size_bytes":       total_size,
                "entries_with_tags":      entries_with_tags,
                "entries_without_tags":   n - entries_with_tags,
                "entries_with_summaries": entries_with_summaries,
                "entries_stale":          entries_stale,
                "backup_count":           backup_count,
                "oldest_date":            min(dates) if dates else None,
                "newest_date":            max(dates) if dates else None,
                "entries_this_week":      entries_this_week,
                "entries_this_month":     entries_this_month,
                "types":                  types,
            })

        elif path.startswith("knowledge/"):
            entry_id = unquote(path[10:])
            for kf in [kd / f"{entry_id}.md", kd / "archived" / f"{entry_id}.md"]:
                if kf.exists():
                    content = kf.read_text("utf-8")
                    fm, body = parse_frontmatter(content)
                    stale = False
                    idx_f = id_ / f"{entry_id}.index.json"
                    if idx_f.exists():
                        try:
                            stale = bool(json.loads(idx_f.read_text("utf-8")).get("summary_stale"))
                        except Exception:
                            pass
                    self.json_out({
                        "id": entry_id, "content": content,
                        "frontmatter": fm, "body": body,
                        "archived": "archived" in str(kf.parent),
                        "summary_stale": stale,
                    })
                    return
            self.err("Not found", 404)

        elif path == "search":
            q    = qs.get("q", [""])[0].lower().strip()
            tags = [t.strip().lower() for t in qs.get("tags", [""])[0].split(",") if t.strip()]
            f    = id_ / "all.json"
            if not f.exists():
                return self.json_out([])
            entries = json.loads(f.read_text("utf-8")).get("entries", [])
            results = []
            for e in entries:
                entry_tags = [t.lower() for t in e.get("tags", [])]
                if tags and not all(t in entry_tags for t in tags):
                    continue
                if q:
                    hay = " ".join([e.get("title",""), e.get("summary",""), *e.get("tags",[])]).lower()
                    meta_match = q in hay
                    snippet = _extract_snippet(ROOT, e.get("knowledge_file", ""), q)
                    if not meta_match and snippet is None:
                        continue
                    e = {**e, "snippet": snippet} if snippet else e
                results.append(e)
            self.json_out(results)

        elif path == "raw":
            files = []
            if rd.exists():
                for f in sorted(rd.glob("*.md"), key=lambda x: -x.stat().st_mtime):
                    mf  = rd / f"{f.stem}.meta.json"
                    meta = json.loads(mf.read_text("utf-8")) if mf.exists() else {}
                    s   = f.stat()
                    files.append({
                        "name": f.name, "stem": f.stem,
                        "size": s.st_size,
                        "modified": datetime.fromtimestamp(s.st_mtime).isoformat(),
                        **meta,
                    })
            self.json_out(files)

        elif path.startswith("raw/"):
            stem = unquote(path[4:])
            rf   = rd / f"{stem}.md"
            if not rf.exists():
                return self.err("Not found", 404)
            mf   = rd / f"{stem}.meta.json"
            meta = json.loads(mf.read_text("utf-8")) if mf.exists() else {}
            self.json_out({"stem": stem, "content": rf.read_text("utf-8"), "meta": meta})

        elif path.startswith("backups/"):
            entry_id = unquote(path[8:])
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            backup_dir = kd / "backups" / entry_id
            if not backup_dir.exists():
                return self.json_out([])
            files = sorted(backup_dir.glob("*.md"), reverse=True)
            self.json_out([{
                "timestamp": f.stem,
                "size": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            } for f in files])

        else:
            self.err("Not found", 404)

    # POST

    def handle_post(self, path, data):
        cfg = self.cfg()
        kd  = get_dir(cfg, "knowledge")
        id_ = get_dir(cfg, "index")

        if path == "knowledge":
            title    = (data.get("title") or "").strip()
            content  = (data.get("content") or "").strip()
            tags     = data.get("tags") or []
            kind     = data.get("type") or "manual"
            entry_id = (data.get("id") or "").strip()
            ui_cfg   = get_ui_cfg(cfg)
            if ui_cfg["require_title"] and not title:
                return self.err("Title is required", 400)
            title = title or "Untitled"
            if not isinstance(tags, list) or any(not isinstance(t, str) for t in tags):
                return self.err("tags must be a list of strings", 400)
            if len(content.encode("utf-8")) > ui_cfg["max_content_bytes"]:
                return self.err(f"Content exceeds {ui_cfg['max_content_bytes']} bytes limit", 413)
            if entry_id:
                try:
                    validate_id(entry_id)
                except ValueError as e:
                    return self.err(str(e), 400)
            else:
                entry_id = f"manual-{slugify(title)}-{int(time.time())}"
            kd.mkdir(exist_ok=True)
            kf = kd / f"{entry_id}.md"
            if kf.exists():
                return self.err("Already exists", 409)
            fm = build_frontmatter({
                "id": entry_id, "title": title, "source": "manual",
                "date": str(date.today()), "tags": tags, "type": kind,
            })
            kf.write_text(fm + "\n\n" + content, encoding="utf-8")
            id_.mkdir(exist_ok=True)
            idx_entry = {
                "id": entry_id, "title": title, "summary": "",
                "tags": tags, "source": "manual",
                "date": str(date.today()), "knowledge_file": f"knowledge/{entry_id}.md",
            }
            (id_ / f"{entry_id}.index.json").write_text(
                json.dumps(idx_entry, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            run("etl/build-index.py")
            self.json_out({"id": entry_id, "created": True})

        elif path == "knowledge/archive":
            entry_id = (data.get("id") or "").strip()
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            kf = kd / f"{entry_id}.md"
            if not kf.exists():
                return self.err("Not found", 404)
            arch = kd / "archived"
            arch.mkdir(exist_ok=True)
            shutil.move(str(kf), str(arch / f"{entry_id}.md"))
            idx = id_ / f"{entry_id}.index.json"
            if idx.exists():
                idx.unlink()
            run("etl/build-index.py")
            self.json_out({"archived": True})

        elif path == "knowledge/unarchive":
            entry_id = (data.get("id") or "").strip()
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            arch_f   = kd / "archived" / f"{entry_id}.md"
            if not arch_f.exists():
                return self.err("Not found", 404)
            shutil.move(str(arch_f), str(kd / f"{entry_id}.md"))
            run("etl/build-index.py")
            self.json_out({"unarchived": True})

        elif path == "knowledge/restore":
            entry_id  = (data.get("id") or "").strip()
            timestamp = (data.get("timestamp") or "").strip()
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            if not re.match(r'^\d{8}T\d{6}$', timestamp):
                return self.err("Invalid timestamp format", 400)
            backup_f = kd / "backups" / entry_id / f"{timestamp}.md"
            if not backup_f.exists():
                return self.err("Backup not found", 404)
            candidates = [kd / f"{entry_id}.md", kd / "archived" / f"{entry_id}.md"]
            current_f  = next((c for c in candidates if c.exists()), candidates[0])
            ui_cfg = get_ui_cfg(cfg)
            if current_f.exists() and ui_cfg["backup_on_update"]:
                create_backup(kd, entry_id, current_f.read_text("utf-8"), ui_cfg["max_backups_per_entry"])
            current_f.parent.mkdir(exist_ok=True)
            current_f.write_text(backup_f.read_text("utf-8"), encoding="utf-8")
            self.json_out({"restored": True, "id": entry_id, "timestamp": timestamp})

        elif path == "etl":
            mode = data.get("mode", "pending")
            flag = "--all" if mode == "all" else "--pending"
            r    = run("etl/process.py", [flag])
            self.json_out({"ok": r.returncode == 0, "output": (r.stdout + r.stderr).strip()})

        elif path == "index/rebuild":
            r = run("etl/build-index.py")
            self.json_out({"ok": r.returncode == 0, "output": (r.stdout + r.stderr).strip()})

        elif path == "pipeline":
            r1 = run("etl/process.py", ["--all"])
            r2 = run("etl/build-index.py")
            self.json_out({
                "ok": r1.returncode == 0 and r2.returncode == 0,
                "output": (r1.stdout + r1.stderr + "\n" + r2.stdout + r2.stderr).strip(),
            })

        elif path == "query":
            question = (data.get("question") or "").strip()
            if not question:
                return self.err("question required")
            tags = data.get("tags") or []
            top  = data.get("top") or cfg.get("claude", {}).get("context_chunks_limit", 10)
            args = [question, "--top", str(top)]
            if tags:
                args += ["--tags", ",".join(tags)]
            r = run("search/query.py", args, timeout=90)
            if r.returncode == 0:
                self.json_out({"answer": r.stdout.strip()})
            else:
                self.err(r.stderr.strip() or "Query failed", 500)

        elif path == "knowledge/regenerate-summary":
            entry_id = (data.get("id") or "").strip()
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            r = run("etl/refresh-summary.py", [entry_id])
            self.json_out({"ok": r.returncode == 0, "output": (r.stdout + r.stderr).strip()})

        elif path == "ingest/url":
            url = (data.get("url") or "").strip()
            if not url:
                return self.err("url required")
            parsed_url = urlparse(url)
            if parsed_url.scheme not in ("http", "https"):
                return self.err("Only http/https URLs are supported")
            title_override = (data.get("title") or "").strip()
            tags = data.get("tags") or []
            if not isinstance(tags, list):
                tags = [t.strip() for t in str(tags).split(",") if t.strip()]
            rd = get_dir(cfg, "raw")
            try:
                html_bytes = _fetch_url(url)
            except Exception as e:
                return self.err(f"Fetch failed: {e}", 502)
            text, detected_title = _html_to_markdown(html_bytes)
            title = title_override or detected_title or url
            stem = f"url-{slugify(title)}-{int(time.time())}"
            rd.mkdir(exist_ok=True)
            fm = build_frontmatter({
                "id": stem, "title": title, "source": url,
                "date": str(date.today()), "tags": tags, "type": "web",
            })
            (rd / f"{stem}.md").write_text(fm + "\n\n" + text, encoding="utf-8")
            (rd / f"{stem}.meta.json").write_text(
                json.dumps({"id": stem, "title": title, "source": url, "tags": tags},
                           ensure_ascii=False),
                encoding="utf-8",
            )
            self.json_out({"stem": stem, "title": title})

        else:
            self.err("Not found", 404)

    # PUT

    def handle_put(self, path, data):
        cfg = self.cfg()
        kd  = get_dir(cfg, "knowledge")
        id_ = get_dir(cfg, "index")

        if path == "config":
            f = ROOT / "powledge.config.json"
            f.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            self.json_out({"saved": True})

        elif path.startswith("knowledge/"):
            entry_id = unquote(path[10:])
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            candidates = [kd / f"{entry_id}.md", kd / "archived" / f"{entry_id}.md"]
            kf = next((c for c in candidates if c.exists()), None)
            if kf is None:
                return self.err("Not found", 404)
            content = data.get("content", "")
            ui_cfg  = get_ui_cfg(cfg)
            if len(content.encode("utf-8")) > ui_cfg["max_content_bytes"]:
                return self.err(f"Content exceeds {ui_cfg['max_content_bytes']} bytes limit", 413)
            old_content = kf.read_text("utf-8")
            _, old_body = parse_frontmatter(old_content)
            if ui_cfg["backup_on_update"]:
                create_backup(kd, entry_id, old_content, ui_cfg["max_backups_per_entry"])
            kf.write_text(content, encoding="utf-8")
            fm_new, new_body = parse_frontmatter(content)
            body_changed = new_body.strip() != old_body.strip()
            idx_file = id_ / f"{entry_id}.index.json"
            if idx_file.exists():
                try:
                    idx_data = json.loads(idx_file.read_text("utf-8"))
                    for field in ("title", "tags"):
                        if field in fm_new:
                            idx_data[field] = fm_new[field]
                    if body_changed:
                        idx_data["summary_stale"] = True
                    idx_file.write_text(json.dumps(idx_data, ensure_ascii=False, indent=2), encoding="utf-8")
                except Exception:
                    pass
            run("etl/build-index.py")
            self.json_out({"id": entry_id, "saved": True})

        else:
            self.err("Not found", 404)

    # DELETE

    def handle_delete(self, path):
        cfg = self.cfg()
        kd  = get_dir(cfg, "knowledge")
        id_ = get_dir(cfg, "index")
        rd  = get_dir(cfg, "raw")

        if path.startswith("knowledge/"):
            entry_id = unquote(path[10:])
            try:
                validate_id(entry_id)
            except ValueError as e:
                return self.err(str(e), 400)
            deleted  = []
            for kf in [kd / f"{entry_id}.md", kd / "archived" / f"{entry_id}.md"]:
                if kf.exists():
                    kf.unlink()
                    deleted.append("knowledge")
            idx = id_ / f"{entry_id}.index.json"
            if idx.exists():
                idx.unlink()
                deleted.append("index")
            run("etl/build-index.py")
            self.json_out({"deleted": deleted})

        elif path.startswith("raw/"):
            stem    = unquote(path[4:])
            deleted = []
            for f in [rd / f"{stem}.md", rd / f"{stem}.meta.json"]:
                if f.exists():
                    f.unlink()
                    deleted.append(f.name)
            self.json_out({"deleted": deleted})

        else:
            self.err("Not found", 404)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    port   = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    server = HTTPServer((HOST, port), Handler)
    url    = f"http://{HOST}:{port}"
    print(f"Powledge UI  ->  {url}")
    print("Press Ctrl+C to stop.")
    try:
        import webbrowser
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Static SEO audit for the Sendora Gift website.

Run from the repository root:
  python scripts/seo_audit.py

By default the report is written to SEO_AUDIT_AFTER.md. An alternate output
path can be passed with --output, which is useful for pre-change audits.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


DOMAIN = "https://www.sendoragift.com/"
SCAN_EXTENSIONS = {".html", ".xml", ".txt", ".css", ".js", ".json"}
MOJIBAKE_PATTERNS = ["\u922b?", "\u9983\u6330", "\u9225?", "\u922d?", "\u951f", "\ufffd", "?/a>", "?/div>", "?/span>"]
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def route_for(path: str) -> str:
    if path == "index.html":
        return ""
    if path.endswith("/index.html"):
        return path[:-10]
    return path


def file_for_href(href: str, source: str, root: Path) -> tuple[Path, str] | None:
    parsed = urllib.parse.urlparse(html.unescape(href.strip()))
    if parsed.scheme in {"http", "https", "mailto", "tel", "sms"}:
        if parsed.netloc and parsed.netloc != "www.sendoragift.com":
            return None
    raw_path = parsed.path
    if raw_path.startswith("/"):
        local = raw_path.lstrip("/")
    elif raw_path:
        local = str((Path(source).parent / raw_path).as_posix())
    else:
        local = source
    local = urllib.parse.unquote(local)
    if local in {"", "."}:
        local = "index.html"
    elif local.endswith("/"):
        local += "index.html"
    elif not Path(local).suffix:
        local += "/index.html"
    return root / local, parsed.fragment


def clean_visible_text(text: str) -> str:
    text = re.sub(r"<script\b.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(re.sub(r"\s+", " ", text)).strip()


def extract(pattern: str, text: str, flags: int = re.I | re.S) -> str:
    match = re.search(pattern, text, flags)
    return html.unescape(match.group(1).strip()) if match else ""


def analyze_html(path: Path, root: Path) -> dict:
    text = read_text(path)
    page = rel(path, root)
    title = extract(r"<title[^>]*>(.*?)</title>", text)
    description = extract(r'<meta\s+name=["\']description["\'][^>]*content=["\'](.*?)["\']', text)
    canonical = extract(r'<link\s+rel=["\']canonical["\'][^>]*href=["\'](.*?)["\']', text)
    h1s = [clean_visible_text(x) for x in re.findall(r"<h1\b[^>]*>(.*?)</h1>", text, flags=re.I | re.S)]
    h2_count = len(re.findall(r"<h2\b", text, flags=re.I))
    img_tags = re.findall(r"<img\b[^>]*>", text, flags=re.I)
    links = re.findall(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>", text, flags=re.I)
    jsonld_types = []
    invalid_jsonld = []
    for block in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', text, flags=re.I | re.S):
        try:
            data = json.loads(html.unescape(block.strip()))
            items = data if isinstance(data, list) else [data]
            for item in items:
                value = item.get("@type") if isinstance(item, dict) else None
                if isinstance(value, list):
                    jsonld_types.extend(str(v) for v in value)
                elif value:
                    jsonld_types.append(str(value))
        except Exception as exc:
            invalid_jsonld.append(str(exc))
    images_missing_alt = [tag for tag in img_tags if not re.search(r"\salt=", tag, flags=re.I)]
    images_missing_size = [tag for tag in img_tags if not re.search(r"\swidth=", tag, flags=re.I) or not re.search(r"\sheight=", tag, flags=re.I)]
    body_words = len(re.findall(r"[A-Za-z0-9]+", clean_visible_text(text)))
    return {
        "path": page,
        "text": text,
        "title": title,
        "description": description,
        "canonical": canonical,
        "h1s": h1s,
        "h2_count": h2_count,
        "word_count": body_words,
        "jsonld_types": jsonld_types,
        "invalid_jsonld": invalid_jsonld,
        "image_count": len(img_tags),
        "images_missing_alt": len(images_missing_alt),
        "images_missing_size": len(images_missing_size),
        "links": links,
        "internal_link_count": sum(1 for href in links if not urllib.parse.urlparse(href).scheme or href.startswith(DOMAIN) or href.startswith("/")),
    }


def find_broken_links(pages: list[dict], root: Path) -> tuple[list[str], list[str], Counter]:
    html_paths = {Path(p["path"]).as_posix() for p in pages}
    html_paths.update(route_for(p["path"]) + "/index.html" for p in pages if p["path"].endswith("/index.html"))
    incoming = Counter()
    broken_links = []
    broken_anchors = []
    anchors_by_page = {}
    for page in pages:
        ids = set(re.findall(r'\sid=["\']([^"\']+)["\']', page["text"], flags=re.I))
        ids.update(re.findall(r'\sname=["\']([^"\']+)["\']', page["text"], flags=re.I))
        anchors_by_page[page["path"]] = ids
    for page in pages:
        for href in page["links"]:
            resolved = file_for_href(href, page["path"], root)
            if not resolved:
                continue
            target, fragment = resolved
            try:
                target_rel = rel(target.resolve(), root.resolve())
            except ValueError:
                continue
            target_rel = target_rel.replace("\\", "/")
            if target_rel.endswith("/index.html") and not target.exists():
                alt = target_rel[:-11] + ".html"
                if (root / alt).exists():
                    target_rel = alt
                    target = root / alt
            if not target.exists():
                broken_links.append(f"{page['path']} -> {href}")
                continue
            if target.suffix.lower() == ".html":
                incoming[target_rel] += 1
                if fragment and fragment not in anchors_by_page.get(target_rel, set()):
                    broken_anchors.append(f"{page['path']} -> {href}")
    return broken_links, broken_anchors, incoming


def load_sitemap(root: Path) -> list[str]:
    sitemap = root / "sitemap.xml"
    if not sitemap.exists():
        return []
    try:
        xml = ET.fromstring(read_text(sitemap))
    except Exception:
        return []
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text.strip() for loc in xml.findall(".//sm:loc", ns) if loc.text]


def load_redirect_sources(root: Path) -> set[str]:
    vercel = root / "vercel.json"
    if not vercel.exists():
        return set()
    try:
        data = json.loads(read_text(vercel))
    except Exception:
        return set()
    return {str(item.get("source", "")).lstrip("/") for item in data.get("redirects", []) if isinstance(item, dict)}


def is_noindex(page: dict) -> bool:
    return bool(re.search(r'<meta\s+name=["\']robots["\'][^>]*noindex', page["text"], flags=re.I))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="SEO_AUDIT_AFTER.md")
    args = parser.parse_args()
    root = Path.cwd()
    scan_files = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in SCAN_EXTENSIONS and ".git" not in p.parts]
    html_files = sorted(p for p in scan_files if p.suffix.lower() == ".html")
    pages = [analyze_html(path, root) for path in html_files]
    redirect_sources = load_redirect_sources(root)
    utility_pages = {"google7f1dcb10b72d685e.html"}
    indexable_pages = [p for p in pages if p["path"] not in redirect_sources and p["path"] not in utility_pages and not is_noindex(p)]
    broken_links, broken_anchors, incoming = find_broken_links(pages, root)
    titles = defaultdict(list)
    descriptions = defaultdict(list)
    h1s = defaultdict(list)
    missing_canonical = []
    multiple_h1 = []
    invalid_jsonld = []
    mojibake_files = []
    malformed_files = []
    for page in indexable_pages:
        titles[page["title"]].append(page["path"])
        descriptions[page["description"]].append(page["path"])
        for h1 in page["h1s"]:
            h1s[h1].append(page["path"])
        if not page["canonical"]:
            missing_canonical.append(page["path"])
        if len(page["h1s"]) != 1:
            multiple_h1.append(f"{page['path']} ({len(page['h1s'])} H1)")
        if page["invalid_jsonld"]:
            invalid_jsonld.append(page["path"])
    for path in scan_files:
        text = read_text(path)
        hits = [pat for pat in MOJIBAKE_PATTERNS if pat in text]
        if hits:
            mojibake_files.append(f"{rel(path, root)}: {', '.join(hits)}")
        stack = []
        bad = []
        for token in re.finditer(r"</?([a-zA-Z0-9:-]+)\b[^>]*>", text):
            tag = token.group(1).lower()
            raw = token.group(0)
            if tag in VOID_TAGS or raw.endswith("/>") or raw.lower().startswith("<!"):
                continue
            if raw.startswith("</"):
                if stack and stack[-1] == tag:
                    stack.pop()
                else:
                    bad.append(raw)
            else:
                stack.append(tag)
        if bad:
            malformed_files.append(f"{rel(path, root)}: {', '.join(bad[:5])}")
    similarity = []
    for i, a in enumerate(indexable_pages):
        for b in indexable_pages[i + 1:]:
            ratio = SequenceMatcher(None, clean_visible_text(a["text"])[:6000], clean_visible_text(b["text"])[:6000]).ratio()
            if ratio >= 0.72:
                similarity.append((ratio, a["path"], b["path"]))
    sitemap_urls = load_sitemap(root)
    sitemap_local = []
    sitemap_missing = []
    sitemap_noindex = []
    for url in sitemap_urls:
        parsed = urllib.parse.urlparse(url)
        local = parsed.path.lstrip("/")
        if local == "":
            local = "index.html"
        elif local.endswith("/"):
            local += "index.html"
        elif not Path(local).suffix:
            local += "/index.html"
        path = root / local
        if not path.exists():
            sitemap_missing.append(url)
            continue
        sitemap_local.append(local)
        if path.suffix.lower() == ".html" and re.search(r'<meta\s+name=["\']robots["\'][^>]*noindex', read_text(path), flags=re.I):
            sitemap_noindex.append(url)
    page_set = {p["path"] for p in pages}
    sitemap_page_set = set(sitemap_local)
    indexable_page_set = {p["path"] for p in indexable_pages}
    pages_missing_from_sitemap = sorted(indexable_page_set - sitemap_page_set)
    orphan_pages = sorted(p for p in indexable_page_set if incoming[p] == 0 and p != "index.html")
    lines = [
        "# SEO Audit Report",
        "",
        f"Scanned files: {len(scan_files)}",
        f"HTML pages: {len(pages)}",
        "",
        "## HTML Page Inventory",
        "",
        "| Page | Title | Meta description | Canonical | H1 | H2 | Words | JSON-LD | Images | Internal links |",
        "|---|---|---|---|---|---:|---:|---|---:|---:|",
    ]
    for page in pages:
        lines.append("| " + " | ".join([
            page["path"],
            page["title"].replace("|", "\\|") or "MISSING",
            page["description"].replace("|", "\\|") or "MISSING",
            page["canonical"] or "MISSING",
            "; ".join(page["h1s"]).replace("|", "\\|") or "MISSING",
            str(page["h2_count"]),
            str(page["word_count"]),
            ", ".join(page["jsonld_types"]) or "None",
            str(page["image_count"]),
            str(page["internal_link_count"]),
        ]) + " |")
    def add_list(title: str, items: list[str], limit: int = 80) -> None:
        lines.extend(["", f"## {title}", ""])
        if not items:
            lines.append("None found.")
        else:
            lines.extend(f"- {item}" for item in items[:limit])
            if len(items) > limit:
                lines.append(f"- ... {len(items) - limit} more")
    add_list("Duplicate Titles", [f"{k}: {', '.join(v)}" for k, v in titles.items() if k and len(v) > 1])
    add_list("Duplicate Meta Descriptions", [f"{k}: {', '.join(v)}" for k, v in descriptions.items() if k and len(v) > 1])
    add_list("Duplicate Or Similar H1", [f"{k}: {', '.join(v)}" for k, v in h1s.items() if k and len(v) > 1])
    add_list("Missing Canonical", missing_canonical)
    add_list("Missing Or Multiple H1", multiple_h1)
    add_list("Images Missing Alt", [f"{p['path']}: {p['images_missing_alt']}" for p in pages if p["images_missing_alt"]])
    add_list("Images Missing Width Or Height", [f"{p['path']}: {p['images_missing_size']}" for p in pages if p["images_missing_size"]])
    add_list("Broken Internal Links", broken_links)
    add_list("Broken Anchor Links", broken_anchors)
    add_list("Invalid HTML Tag Patterns", malformed_files)
    add_list("Invalid JSON-LD", invalid_jsonld)
    add_list("High Similarity Pages", [f"{ratio:.2f}: {a} <-> {b}" for ratio, a, b in sorted(similarity, reverse=True)])
    add_list("Sitemap URLs With Missing Local Files", sitemap_missing)
    add_list("Noindex Pages Included In Sitemap", sitemap_noindex)
    add_list("Pages Missing From Sitemap", pages_missing_from_sitemap)
    add_list("Orphan HTML Pages", orphan_pages)
    add_list("Files Containing Mojibake Or Malformed Text", mojibake_files)
    Path(args.output).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

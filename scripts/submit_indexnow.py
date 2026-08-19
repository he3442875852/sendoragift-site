#!/usr/bin/env python3
"""Submit the production sitemap URLs to IndexNow after a main-branch deploy."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
HOST = "www.sendoragift.com"
KEY = "9dfc83352bdfabdb5f9793c37f14793e"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/indexnow"


def sitemap_urls(path: Path) -> list[str]:
    tree = ElementTree.parse(path)
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.text.strip() for node in tree.findall("sm:url/sm:loc", namespace) if node.text]
    return list(dict.fromkeys(urls))


def wait_for_key(attempts: int = 18, pause_seconds: int = 10) -> None:
    for attempt in range(1, attempts + 1):
        try:
            with urlopen(KEY_LOCATION, timeout=15) as response:
                if response.status == 200 and response.read().decode("utf-8").strip() == KEY:
                    return
        except (HTTPError, URLError, TimeoutError):
            pass
        if attempt < attempts:
            time.sleep(pause_seconds)
    raise RuntimeError(f"IndexNow key was not available at {KEY_LOCATION}")


def submit(urls: list[str]) -> int:
    payload = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }).encode("utf-8")
    request = Request(ENDPOINT, data=payload, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    try:
        with urlopen(request, timeout=30) as response:
            return response.status
    except HTTPError as error:
        if error.code in (200, 202):
            return error.code
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"IndexNow returned HTTP {error.code}: {detail}") from error


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Validate the sitemap and print the payload summary only")
    parser.add_argument("--wait-for-key", action="store_true", help="Wait for the deployed key file before submitting")
    args = parser.parse_args()

    urls = sitemap_urls(ROOT / "sitemap.xml")
    if not urls:
        raise RuntimeError("No URLs were found in sitemap.xml")
    if any(not url.startswith(f"https://{HOST}/") and url != f"https://{HOST}" for url in urls):
        raise RuntimeError("The sitemap contains a URL outside the production host")

    if args.dry_run:
        print(json.dumps({"host": HOST, "keyLocation": KEY_LOCATION, "urlCount": len(urls)}, indent=2))
        return

    if args.wait_for_key:
        wait_for_key()
    status = submit(urls)
    print(f"IndexNow accepted {len(urls)} URLs with HTTP {status}.")


if __name__ == "__main__":
    main()

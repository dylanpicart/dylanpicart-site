---
title: "Automating NYC InfoHub Data Collection with an Intelligent Excel Web Scraper"
description: "How intelligent web scraping, concurrency, and security checks turn NYC InfoHub's sprawling maze of Excel datasets into a fast, verifiable, and human-accessible data repository."
date: 2025-05-16
langs: [Python]
tags: ["Data Engineering", "Automation", "Web Scraping", "Open Data"]
published: true
featured: false
section: professional
---

When data hides behind dozens of pages and endless nested links, the simple act of “downloading Excel files” becomes a logistical nightmare. NYC InfoHub—a central portal for New York City’s educational data—is one such maze: hundreds of links leading to reports, attendance logs, graduation results, and performance dashboards, each buried behind layers of subpages.

To make sense of it all, I built the **Excel API Web Scraper**—a Python package that automates the discovery, validation, and storage of these datasets. It turns a time-consuming, error-prone process into a fast, secure, and transparent data pipeline designed for continuous updates and responsible stewardship.

------------------------------------------------------------------------

### The Challenge: Endless Links and Manual Downloads

Each InfoHub dataset can live several clicks deep, under sections like “School Quality” or “Test Results.” Manually traversing these layers, validating files, and checking for updates can take hours. Beyond the time investment, every manual click risks inconsistency—missing new versions or duplicating old ones. The goal was to make this discovery *automated, safe, and repeatable*.

------------------------------------------------------------------------

### The Solution: Intelligent, Secure, and Fast

This scraper blends modern Python concurrency and security into one cohesive workflow. It combines:

- **Regex-driven subpage discovery** to identify relevant links.
- **Asynchronous downloads** via `httpx.AsyncClient` and `asyncio` for concurrent file retrieval.
- **Parallel hashing** using `ProcessPoolExecutor` to detect file updates across cores.
- **In-memory virus scanning** with `ClamAV` and `python-magic` MIME validation for file safety.
- **Rotating logs and idempotent saves** for stability and long-term maintainability.

It’s not just fast—it’s *safe, idempotent, and transparent*.

------------------------------------------------------------------------

### 1) A Single Entry Point for Automation

The scraper’s orchestration starts with `main.py`, which configures logging and delegates the workflow to an asynchronous `scrape_data()` method. The rotating file handler ensures persistent, structured logs while keeping console output real-time.

```python
# main.py (excerpt)
import os, sys, asyncio, logging
from logging.handlers import RotatingFileHandler
from .scraper import NYCInfoHubScraper

sys.stdout.reconfigure(line_buffering=True)

async def main():
    scraper = NYCInfoHubScraper(base_dir=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    try:
        await scraper.scrape_data()
    except Exception as e:
        logging.error(f"Error: {e}", exc_info=True)
    finally:
        await scraper.close()

if __name__ == "__main__":
    log_path = os.path.join(os.path.dirname(__file__), "..", "logs", "excel_fetch.log")
    handler = RotatingFileHandler(log_path, maxBytes=5_242_880, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

    logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()], force=True)
    sys.exit(asyncio.run(main()))
```

------------------------------------------------------------------------

### 2) Discovering the Right Links with Regex + Selenium

InfoHub’s structure isn’t easily crawlable. The scraper navigates subpages using `Selenium` while applying **regex filters** to include only relevant categories (like “graduation results” or “test-results”) and exclude noise (“login,” “survey,” etc.).

```python
# scraper.py (excerpt)
SUB_PAGE_PATTERN = re.compile(
    r'.*/reports/(students-and-schools/school-quality|academics/graduation-results|test-results)(?:/.*)?',
    re.IGNORECASE
)
EXCLUDED_PATTERNS = ["quality-review", "nyc-school-survey", "signout", "signin", "login", "logout"]

async def discover_relevant_subpages(self, url, depth=1, visited=None):
    self._driver.get(url)
    anchors = self._driver.find_elements(By.TAG_NAME, "a")
    for a in anchors:
        href = a.get_attribute("href")
        if href and SUB_PAGE_PATTERN.match(href):
            discovered_links.add(href)
    ...
```

Only pages containing meaningful subpaths are queued for further scanning—limiting crawl depth and improving speed.

------------------------------------------------------------------------

### 3) Asynchronous, Streaming Downloads

Instead of fetching one file at a time, the scraper downloads multiple Excel files concurrently via `httpx.AsyncClient` with HTTP/2 streaming. This allows efficient, non-blocking I/O operations across hundreds of files.

```python
# scraper.py (excerpt)
async def download_excel(self, url):
    async with self._session.stream("GET", url, timeout=10) as resp:
        if resp.status_code != 200:
            return url, None
        content = b"".join([chunk async for chunk in resp.aiter_bytes(65536)])
        status, msg = self._security_manager.scan_for_viruses(content)
        if status != "FOUND" and self._security_manager.is_excel_file(content):
            return url, content
    return url, None

async def concurrent_fetch(self, urls):
    tasks = [self.download_excel(u) for u in urls]
    results = {}
    for coro in asyncio.as_completed(tasks):
        url, content = await coro
        if content:
            results[url] = content
    return results
```

Every file is streamed, scanned, and verified before saving—no unnecessary re-downloading.

------------------------------------------------------------------------

### 4) Security and MIME Validation

At the heart of the scraper’s safety logic is **SecurityManager**, which ensures every file is what it claims to be. It uses `ClamAV` for virus detection on Linux/WSL and falls back to MIME checks when antivirus scanning isn’t available (e.g., Windows).

```python
# scraper.py (excerpt)
class SecurityManager:
    def __init__(self, clam_socket="/var/run/clamav/clamd.ctl", skip_windows_scan=True):
        self._clam_socket = clam_socket
        self._skip_windows_scan = skip_windows_scan

    def scan_for_viruses(self, file_bytes: bytes):
        if self._skip_windows_scan and platform.system().lower() == "windows":
            return "OK", "Skipping AV check on Windows"
        cd = pyclamd.ClamdUnixSocket(filename=self._clam_socket)
        result = cd.scan_stream(file_bytes)
        return ("FOUND", result.get("stream")[1]) if result else ("OK", "No malware detected")

    def is_excel_file(self, file_bytes: bytes):
        mime_type = magic.from_buffer(file_bytes, mime=True)
        return any(token in mime_type for token in ["ms-excel", "spreadsheetml.sheet"])
```

This combination ensures data integrity across platforms without requiring complex setup on Windows machines.

------------------------------------------------------------------------

### 5) Hashing and Idempotence: Only Save What’s New

Every downloaded file is hashed (SHA-256) using `ProcessPoolExecutor` to parallelize CPU-heavy operations. The scraper compares each hash with previously stored values to detect changes and skip redundant saves.

```python
# scraper.py (excerpt)
def parallel_hashing(self, files_map):
    results = {}
    with concurrent.futures.ProcessPoolExecutor() as executor:
        future_to_url = {
            executor.submit(self.compute_file_hash, content): url
            for url, content in files_map.items()
        }
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            results[url] = future.result()
    return results

def save_file(self, url, content, new_hash):
    file_name = os.path.basename(url)
    category = self._file_manager.categorize_file(file_name, self.CATEGORIES)
    save_path = self._file_manager.get_save_path(category, file_name)
    hash_path = self._file_manager.get_hash_path(category, file_name)

    if not self._file_manager.file_has_changed(hash_path, new_hash):
        return  # Skip identical files

    self._file_manager.save_file(save_path, content)
    self._file_manager.save_hash(hash_path, new_hash)
```

This ensures that every run is fast, efficient, and trustworthy—only downloading, scanning, and saving what’s actually new.

------------------------------------------------------------------------

### 6) The Workflow at a Glance

Together, these components create a streamlined, safe, and scalable data collection process:

1.  Discover subpages via regex + Selenium.
2.  Extract valid Excel links filtered by year (≥ 2018).
3.  Download concurrently via asyncio + httpx.
4.  Scan and validate files using ClamAV + MIME checks.
5.  Compute hashes and save only changed files.
6.  Log every decision for transparent audits.

```python
# scraper.py (excerpt)
async def scrape_data(self):
    excel_links = await self.scrape_excel_links()
    if not excel_links:
        return

    files_map = await self.concurrent_fetch(excel_links)
    if not files_map:
        return

    hash_results = self.parallel_hashing(files_map)
    for url, content in files_map.items():
        new_hash = hash_results.get(url)
        if new_hash:
            self.save_file(url, content, new_hash)
```

------------------------------------------------------------------------

### Why This Matters

Scraping public educational data responsibly means balancing access with integrity. By combining web scraping, concurrency, and real-time validation, the **Excel API Web Scraper** transforms a manual, multi-day task into a repeatable process that runs in minutes—verifying safety, detecting changes, and organizing data automatically.

It’s more than just automation—it’s data stewardship for the open information era.

------------------------------------------------------------------------

**GitHub:** [View in GitHub](https://github.com/dylanpicart/excel_api_access)

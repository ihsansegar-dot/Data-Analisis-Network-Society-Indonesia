"""Pengambilan halaman dengan Scrapling: sopan (robots.txt + jeda per domain) dan fallback stealth."""
from __future__ import annotations

import logging
import threading
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

log = logging.getLogger("fetch")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


class PoliteFetcher:
    """Satu instance per domain (dipakai berurutan di dalam satu thread)."""

    def __init__(self, domain: str, delay: float = 2.5, stealth: bool = False,
                 timeout: int = 30, respect_robots: bool = True, session=None):
        self.domain = domain
        self.delay = delay
        self.stealth = stealth
        self.timeout = timeout
        self.respect_robots = respect_robots
        self._last = 0.0
        self._lock = threading.Lock()
        self._robots: RobotFileParser | None = None
        self.robots_txt = ""
        self._session = session  # disuntikkan saat pengujian
        self._own_session = None

    # ---------- sesi ----------
    def _get_session(self):
        if self._session is None:
            from scrapling.fetchers import FetcherSession
            self._own_session = FetcherSession(impersonate="chrome", stealthy_headers=True,
                                               timeout=self.timeout, retries=2, retry_delay=2,
                                               follow_redirects="safe")
            self._session = self._own_session.__enter__()
        return self._session

    def close(self):
        if self._own_session is not None:
            try:
                self._own_session.__exit__(None, None, None)
            except Exception:  # noqa: BLE001
                pass
            self._own_session = None
            self._session = None

    # ---------- robots ----------
    def load_robots(self, base: str):
        self._robots = RobotFileParser()
        try:
            r = self._raw_get(f"{base}/robots.txt", check_robots=False)
            if r is not None and r.status == 200:
                self.robots_txt = r.body.decode("utf-8", "ignore")
                self._robots.parse(self.robots_txt.splitlines())
            else:
                self._robots.parse([])
        except Exception as e:  # noqa: BLE001
            log.warning("robots.txt %s gagal: %s", base, e)
            self._robots.parse([])

    def allowed(self, url: str) -> bool:
        if not self.respect_robots or self._robots is None:
            return True
        return self._robots.can_fetch(UA, url) and self._robots.can_fetch("*", url)

    def sitemaps_from_robots(self) -> list[str]:
        return [ln.split(":", 1)[1].strip() for ln in self.robots_txt.splitlines()
                if ln.lower().startswith("sitemap:")]

    # ---------- GET ----------
    def _wait(self):
        with self._lock:
            gap = time.monotonic() - self._last
            if gap < self.delay:
                time.sleep(self.delay - gap)
            self._last = time.monotonic()

    def _raw_get(self, url: str, check_robots: bool = True):
        if check_robots and not self.allowed(url):
            log.info("diblokir robots.txt: %s", url)
            return None
        self._wait()
        if self.stealth:
            return self._stealth_get(url)
        r = self._get_session().get(url)
        if r.status in (403, 429, 503) and not self.stealth:
            log.info("HTTP %s di %s — coba StealthyFetcher", r.status, url)
            try:
                r2 = self._stealth_get(url)
                if r2 is not None and r2.status == 200:
                    return r2
            except Exception as e:  # noqa: BLE001
                log.debug("stealth gagal: %s", e)
        return r

    @staticmethod
    def _stealth_get(url: str):
        from scrapling.fetchers import StealthyFetcher
        return StealthyFetcher.fetch(url, headless=True, network_idle=True)

    def get(self, url: str):
        try:
            r = self._raw_get(url)
        except Exception as e:  # noqa: BLE001
            log.warning("GET %s gagal: %s", url, e)
            return None
        if r is None or r.status != 200:
            if r is not None:
                log.info("HTTP %s %s", r.status, url)
            return None
        return r


def resolve_base(fetcher, domain: str) -> str:
    """Coba https://www.<domain> dan https://<domain>; pakai yang pertama menjawab (status < 500)."""
    first = base_url(domain)
    d = urlparse(first).netloc
    alt = d[4:] if d.startswith("www.") else "www." + d
    for b in (first, f"https://{alt}"):
        try:
            r = fetcher._raw_get(f"{b}/robots.txt", check_robots=False)
            if r is not None and r.status < 500:
                return b
        except Exception as e:  # noqa: BLE001
            log.info("%s tidak dapat dijangkau: %s", b, e)
    return first


def base_url(domain: str) -> str:
    d = domain.strip().rstrip("/")
    if d.startswith("http"):
        p = urlparse(d)
        return f"{p.scheme}://{p.netloc}"
    return f"https://www.{d}" if d.count(".") == 1 else f"https://{d}"

"""ClipFlow download server.

Takes a YouTube, TikTok, Instagram, Facebook or X link and returns the video as an MP4,
so the ClipFlow web app can save it to the phone or open it in the editor.

Only for videos you own or have permission to download.

Environment variables (all optional):
  ACCESS_KEY        If set, every request must send header `X-ClipFlow-Key: <value>`.
                    Strongly recommended so strangers can't use your server.
  ALLOWED_ORIGINS   Comma-separated web origins allowed to call the API (CORS). Default "*".
  ALLOWED_ORIGIN_REGEX  Extra allowed origins as a regex, e.g. https://clipflow-.*\.vercel\.app
  MAX_DURATION      Longest video accepted, in seconds. Default 900 (15 min).
  MAX_HEIGHT        Highest resolution fetched. Default 1080.
  MAX_FILESIZE_MB   Largest file accepted. Default 400.
  MAX_CONCURRENT    Downloads allowed at the same time. Default 2.
  COOKIES_FILE      Path to a Netscape cookies.txt (mounted secret), for sites that
                    ask the server to sign in.
"""

from __future__ import annotations

import asyncio
import hmac
import os
import re
import shutil
import tempfile
import urllib.parse
from typing import Any

import yt_dlp
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

ACCESS_KEY = os.environ.get("ACCESS_KEY", "")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
# Extra origins by pattern, e.g. every Vercel preview: https://clipflow-.*\.vercel\.app
ALLOWED_ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX") or None
MAX_DURATION = int(os.environ.get("MAX_DURATION", "900"))
MAX_HEIGHT = int(os.environ.get("MAX_HEIGHT", "1080"))
MAX_FILESIZE = int(os.environ.get("MAX_FILESIZE_MB", "400")) * 1024 * 1024
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT", "2"))
COOKIES_FILE = os.environ.get("COOKIES_FILE", "")

# Only these sites are accepted. Everything else is refused before yt-dlp runs, so the
# server can't be used to fetch arbitrary URLs (including internal cloud addresses).
SITES: dict[str, tuple[re.Pattern[str], list[str]]] = {
    "YouTube": (re.compile(r"(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$"), ["youtube", "youtube:.*"]),
    "TikTok": (re.compile(r"(^|\.)tiktok\.com$"), ["tiktok", "tiktok:.*", "vm\\.tiktok"]),
    "Instagram": (re.compile(r"(^|\.)instagram\.com$"), ["instagram", "instagram:.*"]),
    "Facebook": (re.compile(r"(^|\.)(facebook\.com|fb\.watch)$"), ["facebook", "facebook:.*"]),
    "X": (re.compile(r"(^|\.)(x\.com|twitter\.com)$"), ["twitter", "twitter:.*"]),
}

app = FastAPI(title="ClipFlow download server", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-ClipFlow-Key"],
    expose_headers=["Content-Disposition", "Content-Length", "X-Video-Title", "X-Video-Site"],
    max_age=3600,
)
_slots = asyncio.Semaphore(MAX_CONCURRENT)


class DownloadRequest(BaseModel):
    url: str


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(status_code=status, detail={"code": code, "message": message})


def check_key(key: str | None) -> None:
    if ACCESS_KEY and not hmac.compare_digest(key or "", ACCESS_KEY):
        raise ApiError(401, "bad_key", "Wrong or missing access key. Check it in ClipFlow’s server settings.")


def classify(raw: str) -> tuple[str, str, list[str]]:
    """Returns (clean url, site name, allowed yt-dlp extractors) or raises ApiError."""
    url = raw.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        raise ApiError(400, "bad_url", "That doesn’t look like a web link.")
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https") or not host or len(url) > 2048:
        raise ApiError(400, "bad_url", "That doesn’t look like a web link.")
    for name, (pattern, extractors) in SITES.items():
        if pattern.search(host):
            return url, name, extractors
    raise ApiError(400, "unsupported_site", "Only YouTube, TikTok, Instagram, Facebook and X links are supported.")


def friendly_error(msg: str, site: str) -> ApiError:
    m = msg.lower()
    if "private" in m or "login" in m or "log in" in m or "sign in" in m or "cookies" in m or "not a bot" in m:
        return ApiError(
            403,
            "needs_login",
            f"{site} asked the server to sign in before sharing this video. It may be private, age-restricted, "
            f"or {site} is limiting downloads from cloud servers right now.",
        )
    if "unavailable" in m or "removed" in m or "does not exist" in m or "404" in m:
        return ApiError(404, "unavailable", "This video is unavailable. It may have been deleted or made private.")
    if "unsupported url" in m:
        return ApiError(400, "unsupported_url", f"That {site} link isn’t a single video. Copy the link from the video itself.")
    if "file is larger" in m or "max-filesize" in m:
        return ApiError(413, "too_big", "This video is too large for the server’s limit.")
    if "rate" in m and "limit" in m or "429" in m:
        return ApiError(429, "rate_limited", f"{site} is limiting requests right now. Try again in a few minutes.")
    return ApiError(502, "download_failed", f"Couldn’t get this video from {site}. Try again, or try another link.")


def ydl_options(extractors: list[str], outdir: str) -> dict[str, Any]:
    h = MAX_HEIGHT
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "allowed_extractors": extractors,
        "outtmpl": os.path.join(outdir, "video.%(ext)s"),
        # Prefer H.264 + AAC in MP4 so the file plays and edits everywhere (phones, browsers).
        "format": (
            f"bv*[vcodec^=avc1][height<={h}]+ba[ext=m4a]/"
            f"b[ext=mp4][vcodec^=avc1][height<={h}]/"
            f"bv*[height<={h}]+ba/b[height<={h}]/b"
        ),
        "merge_output_format": "mp4",
        "max_filesize": MAX_FILESIZE,
        "socket_timeout": 20,
        "retries": 2,
        "restrictfilenames": True,
        "postprocessors": [{"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"}],
    }
    if COOKIES_FILE and os.path.exists(COOKIES_FILE):
        # yt-dlp may write back to the cookie file, so use a writable copy.
        tmp = os.path.join(outdir, "cookies.txt")
        shutil.copyfile(COOKIES_FILE, tmp)
        opts["cookiefile"] = tmp
    return opts


def run_download(url: str, site: str, extractors: list[str], outdir: str) -> tuple[str, str]:
    with yt_dlp.YoutubeDL(ydl_options(extractors, outdir)) as ydl:
        info = ydl.extract_info(url, download=False)
        if info is None:
            raise ApiError(404, "unavailable", "This video is unavailable.")
        if info.get("_type") == "playlist":
            entries = [e for e in (info.get("entries") or []) if e]
            if not entries:
                raise ApiError(404, "unavailable", "No video found at this link.")
            info = entries[0]
        if info.get("is_live"):
            raise ApiError(400, "live", "Live streams can’t be downloaded.")
        duration = info.get("duration") or 0
        if duration and duration > MAX_DURATION:
            raise ApiError(
                413, "too_long", f"This video is {round(duration / 60)} min long. The limit is {MAX_DURATION // 60} min."
            )
        ydl.process_ie_result(info, download=True)
        title = str(info.get("title") or f"{site} video")
    files = [f for f in os.listdir(outdir) if f.startswith("video.") and not f.endswith((".part", ".ytdl"))]
    mp4 = [f for f in files if f.endswith(".mp4")]
    chosen = (mp4 or files or [None])[0]
    if not chosen:
        raise ApiError(502, "download_failed", f"Couldn’t get this video from {site}.")
    return os.path.join(outdir, chosen), title


def safe_filename(title: str, ext: str) -> str:
    base = re.sub(r"[^\w\- ]+", "", title, flags=re.UNICODE).strip().replace(" ", "-")[:60] or "video"
    return f"{base}.{ext}"


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "sites": list(SITES), "needsKey": bool(ACCESS_KEY), "maxDuration": MAX_DURATION}


@app.post("/api/download")
async def download(req: DownloadRequest, x_clipflow_key: str | None = Header(default=None)) -> FileResponse:
    check_key(x_clipflow_key)
    url, site, extractors = classify(req.url)
    if _slots.locked():
        raise ApiError(429, "busy", "The server is busy with another download. Try again in a minute.")
    outdir = tempfile.mkdtemp(prefix="clipflow-")
    cleanup = BackgroundTask(shutil.rmtree, outdir, ignore_errors=True)
    try:
        async with _slots:
            path, title = await run_in_threadpool(run_download, url, site, extractors, outdir)
    except ApiError:
        shutil.rmtree(outdir, ignore_errors=True)
        raise
    except yt_dlp.utils.DownloadError as e:  # type: ignore[attr-defined]
        shutil.rmtree(outdir, ignore_errors=True)
        raise friendly_error(str(e), site)
    except Exception:
        shutil.rmtree(outdir, ignore_errors=True)
        raise ApiError(500, "server_error", "Something went wrong on the server. Try again.")

    ext = path.rsplit(".", 1)[-1]
    return FileResponse(
        path,
        media_type="video/mp4" if ext == "mp4" else f"video/{ext}",
        filename=safe_filename(title, ext),
        headers={"X-Video-Title": urllib.parse.quote(title[:200]), "X-Video-Site": site, "Cache-Control": "no-store"},
        background=cleanup,
    )

"""Offline tests for the download server (no real downloads)."""
import importlib
import os

from fastapi.testclient import TestClient


def make(env=None):
    os.environ.pop("ACCESS_KEY", None)
    os.environ.update(env or {})
    import main
    importlib.reload(main)
    return main, TestClient(main.app)


def test_health():
    _, c = make()
    r = c.get("/health")
    assert r.status_code == 200 and r.json()["ok"] and "YouTube" in r.json()["sites"]


def test_key_required():
    _, c = make({"ACCESS_KEY": "s3cret"})
    r = c.post("/api/download", json={"url": "https://youtu.be/abc"})
    assert r.status_code == 401 and r.json()["detail"]["code"] == "bad_key"


def test_rejects_other_sites_and_internal_urls():
    _, c = make()
    for u in ["https://example.com/v.mp4", "http://169.254.169.254/computeMetadata/v1/", "http://localhost:8080/", "ftp://youtube.com/x", "not a url"]:
        r = c.post("/api/download", json={"url": u})
        assert r.status_code == 400, (u, r.text)


def test_classify():
    m, _ = make()
    assert m.classify("youtu.be/xyz")[1] == "YouTube"
    assert m.classify("https://www.tiktok.com/@a/video/1")[1] == "TikTok"
    assert m.classify("https://vm.tiktok.com/ZM123/")[1] == "TikTok"
    assert m.classify("https://www.instagram.com/reel/abc/")[1] == "Instagram"


def test_friendly_errors():
    m, _ = make()
    assert m.friendly_error("Sign in to confirm you’re not a bot", "YouTube").detail["code"] == "needs_login"
    assert m.friendly_error("Video unavailable", "YouTube").detail["code"] == "unavailable"


def test_download_error_mapped(monkeypatch):
    m, c = make()
    def boom(*a, **k):
        raise m.yt_dlp.utils.DownloadError("ERROR: Private video. Sign in if you've been granted access")
    monkeypatch.setattr(m, "run_download", boom)
    r = c.post("/api/download", json={"url": "https://youtu.be/abc"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "needs_login"


def test_download_streams_file_with_cors(monkeypatch, tmp_path):
    m, c = make({"ALLOWED_ORIGINS": "https://clipflow.web.app"})
    def fake(url, site, extractors, outdir):
        p = os.path.join(outdir, "video.mp4")
        open(p, "wb").write(b"\x00" * 1234)
        return p, "My clip!"
    monkeypatch.setattr(m, "run_download", fake)
    r = c.post("/api/download", json={"url": "https://www.tiktok.com/@a/video/1"}, headers={"Origin": "https://clipflow.web.app"})
    assert r.status_code == 200 and len(r.content) == 1234
    assert r.headers["content-type"] == "video/mp4"
    assert r.headers["access-control-allow-origin"] == "https://clipflow.web.app"
    assert "My-clip.mp4" in r.headers["content-disposition"]
    assert r.headers["x-video-site"] == "TikTok"

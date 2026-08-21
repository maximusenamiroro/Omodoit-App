"""
Move existing reel videos from Supabase Storage to Cloudflare R2,
re-encoding them to 720p on the way.

WHY
Reel video is the only part of Omodoit that outgrows Supabase's free
plan, and egress is the reason rather than storage. R2 charges nothing
for egress. Re-encoding at the same time is worth doing because the
videos already published were encoded at CRF 18 at source resolution,
which is close to no compression at all: they average 9.4MB and run up
to 45MB. At 720p30 they land around 2-3MB, so this both moves the bill
and shrinks it.

SAFETY
  * dry-run by default; pass --apply to write anything
  * uploads to R2 FIRST, verifies the object is readable, and only then
    updates the database row
  * never deletes the Supabase original — old URLs keep working, and
    cleanup is a separate deliberate step once you are satisfied
  * skips any reel that fails at any stage and keeps going
  * one row at a time, so an interrupted run leaves a consistent state

CREDENTIALS
Read from the environment. Never hardcode them here and never paste them
into a shell that records history — this file lives in a git repository.

    export R2_ACCOUNT_ID=...
    export R2_ACCESS_KEY_ID=...
    export R2_SECRET_ACCESS_KEY=...
    export R2_BUCKET=...
    export R2_PUBLIC_BASE_URL=https://media.yourdomain.com

Use the same values you gave `supabase secrets set`, so the app and this
script write to the same bucket and produce the same public URLs.

USAGE
    python3 scripts/migrate_reels_to_r2.py            # dry run
    python3 scripts/migrate_reels_to_r2.py --apply
"""
import hashlib
import hmac
import json
import os
import ssl
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone

PROJECT = "xiwdqvoadkcodcgtqxfy"
APPLY = "--apply" in sys.argv
UA = "omodoit-r2-migrate/1.0"
MAX_SOURCE_BYTES = 200 * 1024 * 1024

# ─────────────────────────── Supabase side ───────────────────────────

def mgmt_token() -> str:
    """The Supabase CLI's token from the macOS keychain, so no token is
    written down anywhere. Same approach the poster backfill uses."""
    r = subprocess.run(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
        capture_output=True, text=True,
    )
    return r.stdout.strip()


def query(token: str, sql: str):
    # The management API sits behind Cloudflare, which rejects urllib's
    # default user-agent outright with error 1010. Any real UA passes.
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json",
                 "User-Agent": UA},
        method="POST",
    )
    with urllib.request.urlopen(req, context=ssl.create_default_context()) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


# ────────────────────────── R2 / SigV4 side ──────────────────────────
# Implemented against the standard library rather than boto3 so this
# runs on a machine with nothing installed. R2 is S3-compatible: the
# signature is ordinary AWS SigV4 with region 'auto'.

def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def r2_host(cfg: dict) -> str:
    """The S3 endpoint for this bucket.

    A bucket created with a jurisdictional restriction (EU, FedRAMP) is
    NOT reachable on the default endpoint — it answers 403 AccessDenied
    there, which reads exactly like a permissions problem and sent this
    migration down a long blind alley. omodoit-reels is an EU bucket, so
    it needs <account>.eu.r2.cloudflarestorage.com.

    The region stays 'auto' regardless; signing with 'eu' is rejected
    outright with InvalidRegionName.

    https://developers.cloudflare.com/r2/reference/data-location/
    """
    j = (cfg.get("jurisdiction") or "").strip().lower()
    return f"{cfg['account_id']}.{j + '.' if j else ''}r2.cloudflarestorage.com"


def put_to_r2(cfg: dict, key: str, body: bytes, content_type: str) -> int:
    host = r2_host(cfg)
    # The key can contain '/', which must stay a path separator, but any
    # other reserved character has to be percent-encoded or the
    # signature will not match what R2 recomputes.
    canonical_uri = "/" + cfg["bucket"] + "/" + "/".join(
        urllib.parse.quote(seg, safe="") for seg in key.split("/")
    )

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(body).hexdigest()

    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"

    canonical_request = "\n".join([
        "PUT", canonical_uri, "", canonical_headers, signed_headers, payload_hash,
    ])

    scope = f"{date_stamp}/auto/s3/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, scope,
        hashlib.sha256(canonical_request.encode()).hexdigest(),
    ])

    k_date = _sign(("AWS4" + cfg["secret_key"]).encode(), date_stamp)
    k_region = _sign(k_date, "auto")
    k_service = _sign(k_region, "s3")
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()

    authorization = (
        f"AWS4-HMAC-SHA256 Credential={cfg['access_key']}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    req = urllib.request.Request(
        f"https://{host}{canonical_uri}",
        data=body, method="PUT",
        headers={
            "Authorization": authorization,
            "Content-Type": content_type,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
            # A year. Every object is written to a unique key and never
            # modified, so a viewer should never re-download one.
            "Cache-Control": "public, max-age=31536000, immutable",
            "User-Agent": UA,
        },
    )
    with urllib.request.urlopen(req, context=ssl.create_default_context()) as r:
        return r.status


# ─────────────────────────── media handling ──────────────────────────

def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300,
                                context=ssl.create_default_context()) as r:
        return r.read(MAX_SOURCE_BYTES)


def reencode_720p(src_bytes: bytes, suffix: str) -> bytes:
    """Re-encode to 720p using avconvert, which ships with macOS, so
    nothing has to be installed on a slow connection. Returns the
    original bytes unchanged if the encode fails or comes out larger —
    a bigger file would defeat the point."""
    with tempfile.TemporaryDirectory() as wd:
        src = os.path.join(wd, "in" + suffix)
        out = os.path.join(wd, "out.mp4")
        with open(src, "wb") as f:
            f.write(src_bytes)

        r = subprocess.run(
            ["avconvert", "--source", src, "--output", out,
             "--preset", "Preset1280x720", "--replace"],
            capture_output=True, text=True,
        )
        if r.returncode != 0 or not os.path.exists(out):
            print("       encode failed, uploading original")
            return src_bytes

        with open(out, "rb") as f:
            encoded = f.read()
        if len(encoded) >= len(src_bytes):
            print("       encode was not smaller, uploading original")
            return src_bytes
        return encoded


def main() -> int:
    missing = [k for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
                           "R2_SECRET_ACCESS_KEY", "R2_BUCKET",
                           "R2_PUBLIC_BASE_URL") if not os.environ.get(k)]
    if missing:
        print("Missing environment variables: " + ", ".join(missing))
        print("See the docstring at the top of this file.")
        return 1

    cfg = {
        "account_id": os.environ["R2_ACCOUNT_ID"],
        "access_key": os.environ["R2_ACCESS_KEY_ID"],
        "secret_key": os.environ["R2_SECRET_ACCESS_KEY"],
        "bucket": os.environ["R2_BUCKET"],
        "public_base": os.environ["R2_PUBLIC_BASE_URL"].rstrip("/"),
        # Optional. 'eu' for an EU-jurisdiction bucket, empty otherwise.
        "jurisdiction": os.environ.get("R2_JURISDICTION", ""),
    }
    print(f"endpoint: {r2_host(cfg)}")

    token = mgmt_token()
    if not token:
        print("No Supabase CLI token in the keychain.")
        return 1

    rows = query(token,
                 "select id, user_id, video_url from reels "
                 "where video_url like '%supabase.co/storage%' "
                 "order by created_at desc;")
    print(f"reels still on Supabase Storage: {len(rows)}")
    if not APPLY:
        print("DRY RUN. Re-run with --apply to write.\n")

    moved = failed = 0
    saved_bytes = 0

    for i, row in enumerate(rows, 1):
        rid, uid, url = row["id"], row["user_id"], row["video_url"]
        suffix = ".mov" if url.lower().endswith(".mov") else ".mp4"
        try:
            original = download(url)
            encoded = reencode_720p(original, suffix)
            key = f"{uid}/{rid}.mp4" if encoded is not original else f"{uid}/{rid}{suffix}"
            content_type = "video/mp4" if key.endswith(".mp4") else "video/quicktime"

            before_mb = len(original) / 1024 / 1024
            after_mb = len(encoded) / 1024 / 1024
            saved_bytes += len(original) - len(encoded)

            if not APPLY:
                print(f"  {i:>2}. {rid[:8]}  {before_mb:5.1f}MB -> {after_mb:5.1f}MB  would upload {key}")
                moved += 1
                continue

            status = put_to_r2(cfg, key, encoded, content_type)
            if status not in (200, 201):
                raise RuntimeError(f"R2 returned {status}")

            public = f"{cfg['public_base']}/{key}"

            # Verify it is actually readable before repointing the row.
            # A signed PUT can succeed against a bucket that is not
            # published, which would leave the feed pointing at URLs that
            # 404 for every user.
            check = urllib.request.Request(public, method="HEAD",
                                           headers={"User-Agent": UA})
            with urllib.request.urlopen(check, timeout=60,
                                        context=ssl.create_default_context()) as r:
                if r.status != 200:
                    raise RuntimeError(f"uploaded but not public ({r.status})")

            # Only now is it safe to move the row over. The Supabase
            # original is deliberately left in place.
            query(token, "update reels set video_url = "
                         f"'{public}' where id = '{rid}';")
            print(f"  {i:>2}. {rid[:8]}  {before_mb:5.1f}MB -> {after_mb:5.1f}MB  OK")
            moved += 1

        except Exception as e:
            print(f"  {i:>2}. {rid[:8]}  FAILED  {type(e).__name__}: {str(e)[:70]}")
            failed += 1

    print(f"\nmoved {moved}, failed {failed}, "
          f"saved {saved_bytes / 1024 / 1024:.0f}MB by re-encoding")
    if APPLY and moved:
        print("Supabase originals were left in place. Once the feed looks "
              "right, delete them to reclaim the storage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

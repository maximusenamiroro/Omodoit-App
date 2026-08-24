"""
Creates the demo account Apple and Google reviewers sign in with.

WHY
Omodoit shows a login screen before anything else. A reviewer who cannot
get past it rejects the build — Apple's Guideline 2.1 lists "we were
unable to sign in" as a standard rejection, and it is one of the most
common reasons a first submission comes back. The credentials go in App
Store Connect under App Review Information, and in the Play Console
under App access.

WHY A REAL ACCOUNT RATHER THAN A BACK DOOR
Some apps ship a hardcoded reviewer bypass. Do not: it is a permanent
unauthenticated path into production that ships in every binary, and
Apple rejects it on sight when they notice. This is an ordinary account
that happens to be given to a reviewer.

WHY A CLIENT ACCOUNT
The client side is what a reviewer needs to see: the reels feed, search,
the report and block controls under Guideline 1.2, and account deletion
under 5.1.1(v). A worker account additionally exposes payouts and job
management, which is more surface than the review needs.

USAGE
The password is yours, never mine, and never written to this file:

    read -s -p "Demo password: " DEMO_PW && export DEMO_PW && echo
    python3 scripts/create_review_account.py
    unset DEMO_PW

`read -s` hides it as you type. It stays in the environment of that one
shell and is gone when you unset it.

Re-running resets the existing demo account's password rather than
creating a second one.
"""
import json
import os
import ssl
import subprocess
import sys
import urllib.request
import urllib.error

PROJECT = "xiwdqvoadkcodcgtqxfy"
BASE = f"https://{PROJECT}.supabase.co"
UA = "omodoit-review-setup/1.0"
CTX = ssl.create_default_context()

DEMO_EMAIL = "appreview@omodoit.com"
DEMO_NAME = "App Review"

def mgmt_token() -> str:
    r = subprocess.run(["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
                       capture_output=True, text=True)
    return r.stdout.strip()

def api(url, token, method="GET", body=None, extra=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": UA}
    if extra:
        h.update(extra)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, context=CTX, timeout=90) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None

def sql(token, query):
    return api(f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
               token, "POST", {"query": query})

def main() -> int:
    password = os.environ.get("DEMO_PW", "")
    if len(password) < 8:
        print("Set DEMO_PW first (at least 8 characters). See the notes at the top of this file.")
        return 1

    token = mgmt_token()
    if not token:
        print("No Supabase CLI token in the keychain.")
        return 1

    keys = api(f"https://api.supabase.com/v1/projects/{PROJECT}/api-keys?reveal=true", token)
    srk = next(k["api_key"] for k in keys if k.get("name") == "service_role")

    existing = sql(token, f"select id from auth.users where email = '{DEMO_EMAIL}';")
    if existing:
        uid = existing[0]["id"]
        api(f"{BASE}/auth/v1/admin/users/{uid}", srk, "PUT",
            {"password": password, "email_confirm": True}, {"apikey": srk})
        print(f"Existing demo account found — password reset. ({uid[:8]}…)")
    else:
        # email_confirm skips the verification step. A reviewer cannot
        # receive your confirmation email, so an unconfirmed account is
        # the same as no account at all.
        user = api(f"{BASE}/auth/v1/admin/users", srk, "POST",
                   {"email": DEMO_EMAIL, "password": password, "email_confirm": True},
                   {"apikey": srk})
        uid = user["id"]
        print(f"Demo account created. ({uid[:8]}…)")

    # A profile row, or the app has an authenticated user with nothing to
    # show and the reviewer sees an empty shell.
    sql(token, f"""
        insert into profiles (id, full_name, role, country, created_at)
        values ('{uid}', '{DEMO_NAME}', 'client', 'Nigeria', now())
        on conflict (id) do update
          set full_name = excluded.full_name, role = excluded.role;
    """)

    feed = sql(token, "select count(*) n from reels;")[0]["n"]
    print()
    print("  Email    :", DEMO_EMAIL)
    print("  Password : (the one you just set — put it in App Store Connect)")
    print("  Role     : client")
    print(f"  Feed has {feed} reels, so the reviewer sees a populated app.")
    print()
    print("Put these in:")
    print("  App Store Connect -> your app -> App Review Information -> Sign-In Required")
    print("  Play Console      -> App content -> App access -> All functionality requires login")
    return 0

if __name__ == "__main__":
    sys.exit(main())

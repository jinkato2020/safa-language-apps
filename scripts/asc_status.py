#!/usr/bin/env python3
"""App Store Connect API でアプリの版・審査状態・ビルド処理状態を取得する CLI。

CI(GitHub Actions)から ASC APIキーで実行する前提(ローカルに鍵を置かない運用)。
認証は環境変数:
  ASC_KEY_ID     = APP_STORE_CONNECT_KEY_ID
  ASC_ISSUER_ID  = APP_STORE_CONNECT_ISSUER_ID
  ASC_KEY_PATH   = .p8 秘密鍵ファイルのパス

サブコマンド:
  status   各アプリの App Store バージョン(審査状態)と最新ビルド(処理状態)を表示
  builds   各アプリの最新ビルド一覧(処理状態/期限切れ)を表示
"""
import argparse
import os
import sys
import time

import jwt
import requests

BASE = "https://api.appstoreconnect.apple.com/v1"
BUNDLES = {
    "A": ("com.safa.nepali.jp", "App A・ネパール語"),
    "B": ("com.safa.japanese", "App B・日本語"),
    "C": ("com.safa.english", "App C・英語"),
}


def token():
    kid = os.environ.get("ASC_KEY_ID", "").strip()
    iss = os.environ.get("ASC_ISSUER_ID", "").strip()
    path = os.environ.get("ASC_KEY_PATH", "").strip()
    if not (kid and iss and path and os.path.isfile(path)):
        sys.exit(f"ERROR: ASC認証情報が不足 (kid={bool(kid)}, iss={bool(iss)}, key={path!r})")
    with open(path) as f:
        key = f.read()
    now = int(time.time())
    return jwt.encode(
        {"iss": iss, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        key, algorithm="ES256", headers={"kid": kid, "typ": "JWT"},
    )


def api(tok, path, params=None):
    r = requests.get(f"{BASE}{path}", headers={"Authorization": f"Bearer {tok}"}, params=params, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code} {path}: {r.text[:300]}")
    return r.json()


def resolve_apps(app_arg):
    if app_arg in ("ALL", "all", None, ""):
        return ["A", "B", "C"]
    return [a.strip().upper() for a in app_arg.split(",") if a.strip()]


def find_app(tok, bundle):
    data = api(tok, "/apps", {"filter[bundleId]": bundle, "limit": 1}).get("data", [])
    return data[0] if data else None


def cmd_status(tok, args):
    for key in resolve_apps(args.app):
        bundle, label = BUNDLES[key]
        print(f"\n=== {label} ({bundle}) ===")
        app = find_app(tok, bundle)
        if not app:
            print("  アプリが見つかりません(権限/未登録?)")
            continue
        aid = app["id"]
        # App Store バージョン(審査状態)
        vers = api(tok, f"/apps/{aid}/appStoreVersions",
                   {"limit": 5, "fields[appStoreVersions]": "versionString,appStoreState,platform,createdDate"}).get("data", [])
        if not vers:
            print("  バージョンなし")
        for v in vers:
            a = v["attributes"]
            print(f"  版 {a.get('versionString')} [{a.get('platform')}] — {a.get('appStoreState')}")
        # 最新ビルド(処理状態)
        builds = api(tok, "/builds",
                     {"filter[app]": aid, "limit": 3, "sort": "-version",
                      "fields[builds]": "version,processingState,uploadedDate,expired"}).get("data", [])
        for b in builds:
            a = b["attributes"]
            exp = " (期限切れ)" if a.get("expired") else ""
            print(f"  ビルド {a.get('version')} processing={a.get('processingState')}{exp}")


def cmd_builds(tok, args):
    for key in resolve_apps(args.app):
        bundle, label = BUNDLES[key]
        app = find_app(tok, bundle)
        if not app:
            print(f"{label}: アプリ未検出")
            continue
        builds = api(tok, "/builds",
                     {"filter[app]": app["id"], "limit": 10, "sort": "-version",
                      "fields[builds]": "version,processingState,uploadedDate,expired"}).get("data", [])
        print(f"\n=== {label} ({bundle}) 最新ビルド ===")
        for b in builds:
            a = b["attributes"]
            exp = " (期限切れ)" if a.get("expired") else ""
            print(f"  {a.get('version')}  processing={a.get('processingState')}  uploaded={a.get('uploadedDate')}{exp}")


def main():
    p = argparse.ArgumentParser(description="App Store Connect 状態取得 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("status"); sp.add_argument("--app", default="ALL"); sp.set_defaults(fn=cmd_status)
    sp = sub.add_parser("builds"); sp.add_argument("--app", default="ALL"); sp.set_defaults(fn=cmd_builds)
    args = p.parse_args()
    tok = token()
    args.fn(tok, args)


if __name__ == "__main__":
    main()

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
    "J": ("com.safa.jlpt", "まいにちJLPT"),  # iOS新規(別Expoプロジェクト)。ALL(=A,B,C)には含めず app=J で個別照会。
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


def api_patch(tok, path, body):
    r = requests.patch(f"{BASE}{path}", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                       json=body, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code} {path}: {r.text[:300]}")
    return r.json()


def api_post(tok, path, body):
    r = requests.post(f"{BASE}{path}", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                      json=body, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code} {path}: {r.text[:300]}")
    return r.json()


# リリース方法を変更できる(まだ公開前の)状態
EDITABLE_STATES = {
    "PREPARE_FOR_SUBMISSION", "WAITING_FOR_REVIEW", "IN_REVIEW",
    "PENDING_DEVELOPER_RELEASE", "DEVELOPER_REJECTED", "REJECTED",
    "METADATA_REJECTED", "INVALID_BINARY", "WAITING_FOR_EXPORT_COMPLIANCE",
}


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


def cmd_set_release_type(tok, args):
    target = args.release_type.upper()  # MANUAL / AFTER_APPROVAL
    for key in resolve_apps(args.app):
        bundle, label = BUNDLES[key]
        print(f"\n=== {label} ({bundle}) ===")
        app = find_app(tok, bundle)
        if not app:
            print("  アプリ未検出"); continue
        vers = api(tok, f"/apps/{app['id']}/appStoreVersions",
                   {"limit": 10, "fields[appStoreVersions]": "versionString,appStoreState,releaseType"}).get("data", [])
        targets = [v for v in vers if v["attributes"].get("appStoreState") in EDITABLE_STATES]
        if not targets:
            print("  公開前(編集可能)バージョンが見つかりません。状態:",
                  ", ".join(f"{v['attributes'].get('versionString')}={v['attributes'].get('appStoreState')}" for v in vers))
            continue
        for v in targets:
            a = v["attributes"]
            cur = a.get("releaseType")
            vs, st = a.get("versionString"), a.get("appStoreState")
            if cur == target:
                print(f"  版 {vs} [{st}] releaseType={cur} → 既に{target}（変更不要）")
                continue
            api_patch(tok, f"/appStoreVersions/{v['id']}",
                      {"data": {"type": "appStoreVersions", "id": v["id"], "attributes": {"releaseType": target}}})
            print(f"  版 {vs} [{st}] releaseType {cur} → {target} に変更しました")


def cmd_release(tok, args):
    """承認済み(PENDING_DEVELOPER_RELEASE)の版を手動リリースする(公開リクエスト発行)。"""
    for key in resolve_apps(args.app):
        bundle, label = BUNDLES[key]
        print(f"\n=== {label} ({bundle}) ===")
        app = find_app(tok, bundle)
        if not app:
            print("  アプリ未検出"); continue
        vers = api(tok, f"/apps/{app['id']}/appStoreVersions",
                   {"limit": 10, "fields[appStoreVersions]": "versionString,appStoreState,releaseType"}).get("data", [])
        target = next((v for v in vers if v["attributes"].get("appStoreState") == "PENDING_DEVELOPER_RELEASE"), None)
        if not target:
            states = ", ".join(f"{v['attributes'].get('versionString')}={v['attributes'].get('appStoreState')}" for v in vers[:5])
            print(f"  リリース待ち(PENDING_DEVELOPER_RELEASE)の版なし。現状: {states}")
            continue
        vs = target["attributes"].get("versionString")
        api_post(tok, "/appStoreVersionReleaseRequests",
                 {"data": {"type": "appStoreVersionReleaseRequests",
                           "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": target["id"]}}}}})
        print(f"  版 {vs} をリリースしました(公開処理開始 → まもなく READY_FOR_SALE)")


def cmd_set_privacy_url(tok, args):
    """App情報(appInfoLocalizations)の privacyPolicyUrl を全ロケールに設定する。"""
    url = (args.url or "").strip()
    if not url:
        sys.exit("ERROR: --url が空です")
    for key in resolve_apps(args.app):
        bundle, label = BUNDLES[key]
        print(f"\n=== {label} ({bundle}) ===")
        app = find_app(tok, bundle)
        if not app:
            print("  アプリ未検出"); continue
        infos = api(tok, f"/apps/{app['id']}/appInfos").get("data", [])
        if not infos:
            print("  appInfo なし"); continue
        done = 0
        for info in infos:
            locs = api(tok, f"/appInfos/{info['id']}/appInfoLocalizations",
                       {"fields[appInfoLocalizations]": "locale,privacyPolicyUrl", "limit": 50}).get("data", [])
            for loc in locs:
                lc = loc["attributes"].get("locale")
                try:
                    api_patch(tok, f"/appInfoLocalizations/{loc['id']}",
                              {"data": {"type": "appInfoLocalizations", "id": loc["id"],
                                        "attributes": {"privacyPolicyUrl": url}}})
                    print(f"  [{lc}] privacyPolicyUrl ← {url}")
                    done += 1
                except RuntimeError as e:
                    print(f"  [{lc}] 失敗: {e}")
        if done == 0:
            print("  ※設定できたロケールなし（権限/状態/Web専用の可能性）")


def main():
    p = argparse.ArgumentParser(description="App Store Connect 状態取得 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("status"); sp.add_argument("--app", default="ALL"); sp.set_defaults(fn=cmd_status)
    sp = sub.add_parser("builds"); sp.add_argument("--app", default="ALL"); sp.set_defaults(fn=cmd_builds)
    sp = sub.add_parser("set-release-type")
    sp.add_argument("--app", default="ALL")
    sp.add_argument("--release-type", default="MANUAL", choices=["MANUAL", "AFTER_APPROVAL"])
    sp.set_defaults(fn=cmd_set_release_type)
    sp = sub.add_parser("release"); sp.add_argument("--app", default="ALL"); sp.set_defaults(fn=cmd_release)
    sp = sub.add_parser("set-privacy-url"); sp.add_argument("--app", default="ALL"); sp.add_argument("--url", default=""); sp.set_defaults(fn=cmd_set_privacy_url)
    args = p.parse_args()
    tok = token()
    args.fn(tok, args)


if __name__ == "__main__":
    main()

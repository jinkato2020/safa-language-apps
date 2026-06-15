#!/usr/bin/env python3
"""Google Play Console を Play Developer API v3 で操作する CLI。

CI(GitHub Actions)から SA 鍵で実行する前提。ローカルに鍵は置かない運用。
認証は環境変数 SA_JSON_PATH(サービスアカウントJSONのパス)を使う。

サブコマンド:
  status      各アプリ/トラックのリリース状態(版コード/status/ロールアウト%)を取得(読み取り専用)
  rollout     本番等トラックの段階ロールアウト割合を変更 / 100%公開
  halt        進行中リリースを停止(halted)
  listing-get 指定言語のストア掲載情報(タイトル/説明)を取得
  listing-set 掲載情報を更新(store-listing/<pkg>/<lang>.json から読む)
  testers-get トラックに割当たっている Google グループ一覧を取得
  testers-set トラックの Google グループ割当を設定(個別メールは不可。グループのみ)

注意: 個別メールのテスター一括追加は Play API に存在しない(Googleグループ運用が前提)。
"""
import argparse
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
PKGS = {
    "A": "com.safa.nepali.jp",   # 聞いて話せるネパール語
    "B": "com.safa.japanese",    # 聞いて話せる日本語
    "C": "com.safa.english",     # 聞いて話せる英語
}
APP_LABEL = {"A": "App A・ネパール語", "B": "App B・日本語", "C": "App C・英語"}


def svc():
    path = os.environ.get("SA_JSON_PATH")
    if not path or not os.path.isfile(path):
        sys.exit(f"ERROR: SA_JSON_PATH が無効です: {path!r}")
    creds = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


def resolve_apps(app_arg):
    if app_arg in ("ALL", "all", None, ""):
        return ["A", "B", "C"]
    keys = [a.strip().upper() for a in app_arg.split(",") if a.strip()]
    for k in keys:
        if k not in PKGS:
            sys.exit(f"ERROR: 不明なアプリ {k!r} (A/B/C/ALL)")
    return keys


def new_edit(s, pkg):
    return s.edits().insert(packageName=pkg, body={}).execute()["id"]


def cmd_status(s, args):
    for key in resolve_apps(args.app):
        pkg = PKGS[key]
        print(f"\n=== {APP_LABEL[key]} ({pkg}) ===")
        try:
            eid = new_edit(s, pkg)
        except HttpError as e:
            print(f"  取得失敗: {e}")
            continue
        try:
            tracks = s.edits().tracks().list(packageName=pkg, editId=eid).execute().get("tracks", [])
            if not tracks:
                print("  トラックなし")
            for t in tracks:
                name = t.get("track")
                rels = t.get("releases", [])
                if not rels:
                    print(f"  [{name}] リリースなし")
                for r in rels:
                    vc = ",".join(str(v) for v in r.get("versionCodes", []))
                    status = r.get("status", "?")
                    frac = r.get("userFraction")
                    fr = f" rollout={frac*100:.0f}%" if frac is not None else ""
                    rname = r.get("name", "")
                    print(f"  [{name}] v{rname} 版コード={vc} status={status}{fr}")
        finally:
            # 読み取り専用なので commit せず破棄
            try:
                s.edits().delete(packageName=pkg, editId=eid).execute()
            except HttpError:
                pass


def _get_track(s, pkg, eid, track):
    return s.edits().tracks().get(packageName=pkg, editId=eid, track=track).execute()


def cmd_rollout(s, args):
    key = resolve_apps(args.app)[0]
    pkg = PKGS[key]
    frac = float(args.fraction)
    eid = new_edit(s, pkg)
    body = _get_track(s, pkg, eid, args.track)
    rels = body.get("releases", [])
    if not rels:
        sys.exit(f"ERROR: {args.track} に編集可能なリリースがありません")
    rel = rels[0]
    if frac >= 1.0:
        rel["status"] = "completed"
        rel.pop("userFraction", None)
        print(f"{APP_LABEL[key]} [{args.track}] を 100% 公開(completed) にします")
    else:
        rel["status"] = "inProgress"
        rel["userFraction"] = frac
        print(f"{APP_LABEL[key]} [{args.track}] を rollout={frac*100:.0f}% にします")
    s.edits().tracks().update(packageName=pkg, editId=eid, track=args.track, body=body).execute()
    s.edits().commit(packageName=pkg, editId=eid).execute()
    print("  完了(commit済)")


def cmd_halt(s, args):
    key = resolve_apps(args.app)[0]
    pkg = PKGS[key]
    eid = new_edit(s, pkg)
    body = _get_track(s, pkg, eid, args.track)
    rels = body.get("releases", [])
    if not rels:
        sys.exit("ERROR: 対象リリースなし")
    rels[0]["status"] = "halted"
    s.edits().tracks().update(packageName=pkg, editId=eid, track=args.track, body=body).execute()
    s.edits().commit(packageName=pkg, editId=eid).execute()
    print(f"{APP_LABEL[key]} [{args.track}] を halted にしました")


def cmd_listing_get(s, args):
    for key in resolve_apps(args.app):
        pkg = PKGS[key]
        eid = new_edit(s, pkg)
        try:
            if args.lang:
                ls = [s.edits().listings().get(packageName=pkg, editId=eid, language=args.lang).execute()]
            else:
                ls = s.edits().listings().list(packageName=pkg, editId=eid).execute().get("listings", [])
            print(f"\n=== {APP_LABEL[key]} ({pkg}) ===")
            for l in ls:
                print(f"  [{l.get('language')}] title={l.get('title')!r} short={l.get('shortDescription')!r}")
        finally:
            try:
                s.edits().delete(packageName=pkg, editId=eid).execute()
            except HttpError:
                pass


def cmd_listing_set(s, args):
    key = resolve_apps(args.app)[0]
    pkg = PKGS[key]
    # store-listing/<pkg>/<lang>.json から読む
    fpath = os.path.join("store-listing", pkg, f"{args.lang}.json")
    if not os.path.isfile(fpath):
        sys.exit(f"ERROR: 掲載情報ファイルがありません: {fpath}\n  {{title, shortDescription, fullDescription}} を含むJSONを置いてください")
    with open(fpath, encoding="utf-8") as f:
        data = json.load(f)
    eid = new_edit(s, pkg)
    body = {
        "language": args.lang,
        "title": data["title"],
        "shortDescription": data["shortDescription"],
        "fullDescription": data["fullDescription"],
    }
    if data.get("video"):
        body["video"] = data["video"]
    s.edits().listings().update(packageName=pkg, editId=eid, language=args.lang, body=body).execute()
    s.edits().commit(packageName=pkg, editId=eid).execute()
    print(f"{APP_LABEL[key]} [{args.lang}] 掲載情報を更新しました(commit済)")


def cmd_testers_get(s, args):
    for key in resolve_apps(args.app):
        pkg = PKGS[key]
        eid = new_edit(s, pkg)
        try:
            t = s.edits().testers().get(packageName=pkg, editId=eid, track=args.track).execute()
            print(f"{APP_LABEL[key]} [{args.track}] googleGroups={t.get('googleGroups', [])}")
        except HttpError as e:
            print(f"{APP_LABEL[key]} [{args.track}] 取得失敗: {e}")
        finally:
            try:
                s.edits().delete(packageName=pkg, editId=eid).execute()
            except HttpError:
                pass


def cmd_testers_set(s, args):
    key = resolve_apps(args.app)[0]
    pkg = PKGS[key]
    groups = [g.strip() for g in args.groups.split(",") if g.strip()]
    eid = new_edit(s, pkg)
    s.edits().testers().update(
        packageName=pkg, editId=eid, track=args.track, body={"googleGroups": groups}
    ).execute()
    s.edits().commit(packageName=pkg, editId=eid).execute()
    print(f"{APP_LABEL[key]} [{args.track}] googleGroups を {groups} に設定しました(commit済)")
    print("注: 個別メールはグループ側に追加してください(Play APIでは不可)")


def main():
    p = argparse.ArgumentParser(description="Play Console 操作 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("status"); sp.add_argument("--app", default="ALL"); sp.set_defaults(fn=cmd_status)
    sp = sub.add_parser("rollout"); sp.add_argument("--app", required=True); sp.add_argument("--track", default="production"); sp.add_argument("--fraction", required=True); sp.set_defaults(fn=cmd_rollout)
    sp = sub.add_parser("halt"); sp.add_argument("--app", required=True); sp.add_argument("--track", default="production"); sp.set_defaults(fn=cmd_halt)
    sp = sub.add_parser("listing-get"); sp.add_argument("--app", default="ALL"); sp.add_argument("--lang", default=""); sp.set_defaults(fn=cmd_listing_get)
    sp = sub.add_parser("listing-set"); sp.add_argument("--app", required=True); sp.add_argument("--lang", required=True); sp.set_defaults(fn=cmd_listing_set)
    sp = sub.add_parser("testers-get"); sp.add_argument("--app", default="ALL"); sp.add_argument("--track", default="alpha"); sp.set_defaults(fn=cmd_testers_get)
    sp = sub.add_parser("testers-set"); sp.add_argument("--app", required=True); sp.add_argument("--track", default="alpha"); sp.add_argument("--groups", required=True); sp.set_defaults(fn=cmd_testers_set)

    args = p.parse_args()
    s = svc()
    args.fn(s, args)


if __name__ == "__main__":
    main()

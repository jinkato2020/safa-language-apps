#!/usr/bin/env python3
"""App Store Connect のメタデータ(名前/サブタイトル/説明/キーワード/プロモ)を API で投入。
対象アプリ=App B(com.safa.japanese)。locale=en-US/ja/zh-Hans/vi。
 inspect: 現状(バージョン/appInfo/各localization)を表示(読み取り専用)
 apply:   編集可能バージョンを取得(無ければ作成) → 各localeの name/subtitle と desc/keywords/promo/whatsNew を更新(無ければ作成)
認証env: ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH
引数: inspect | apply [versionString]   (既定 1.3.0)
"""
import json, os, sys, time
import jwt, requests

BASE = "https://api.appstoreconnect.apple.com/v1"
BUNDLE = "com.safa.japanese"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = json.load(open(os.path.join(ROOT, "store-assets", "appb_metadata.json"), encoding="utf-8"))
LOC = META["appstore_locales"]   # en->en-US, ja->ja, zh->zh-Hans, vi->vi
WHATSNEW = {
    "en": "Added Chinese language support, horizontal swipe navigation, and various refinements.",
    "ja": "中国語対応の追加、横スワイプ操作、細かな改善を行いました。",
    "zh": "新增中文支持、横向滑动切换，以及多项优化。",
    "vi": "Thêm hỗ trợ tiếng Trung, vuốt ngang để chuyển, và nhiều cải tiến.",
}
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED",
            "INVALID_BINARY", "WAITING_FOR_REVIEW", "PROCESSING_FOR_APP_STORE"}


def token():
    kid, iss, path = os.environ.get("ASC_KEY_ID", "").strip(), os.environ.get("ASC_ISSUER_ID", "").strip(), os.environ.get("ASC_KEY_PATH", "").strip()
    key = open(path).read()
    now = int(time.time())
    return jwt.encode({"iss": iss, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
                      key, algorithm="ES256", headers={"kid": kid, "typ": "JWT"})


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def get(tok, path, params=None):
    r = requests.get(f"{BASE}{path}", headers=H(tok), params=params, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"GET {path} -> {r.status_code} {r.text[:300]}")
    return r.json()


def post(tok, path, body):
    r = requests.post(f"{BASE}{path}", headers=H(tok), json=body, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"POST {path} -> {r.status_code} {r.text[:400]}")
    return r.json()


def patch(tok, path, body):
    r = requests.patch(f"{BASE}{path}", headers=H(tok), json=body, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"PATCH {path} -> {r.status_code} {r.text[:400]}")
    return r.json()


def find_app(tok):
    d = get(tok, "/apps", {"filter[bundleId]": BUNDLE, "limit": 1})["data"]
    if not d:
        raise SystemExit("app not found")
    return d[0]["id"]


def editable_version(tok, aid, vstr, create=False):
    vers = get(tok, f"/apps/{aid}/appStoreVersions", {"limit": 20, "filter[platform]": "IOS"})["data"]
    for v in vers:
        if v["attributes"]["appStoreState"] in EDITABLE:
            return v, vers
    if create:
        body = {"data": {"type": "appStoreVersions",
                         "attributes": {"platform": "IOS", "versionString": vstr},
                         "relationships": {"app": {"data": {"type": "apps", "id": aid}}}}}
        v = post(tok, "/appStoreVersions", body)["data"]
        print(f"created version {vstr} id={v['id']}")
        return v, vers + [v]
    return None, vers


def editable_appinfo(tok, aid):
    infos = get(tok, f"/apps/{aid}/appInfos", {"limit": 10})["data"]
    for inf in infos:
        st = inf["attributes"].get("appStoreState") or inf["attributes"].get("state")
        if st in EDITABLE or st is None:
            return inf, infos
    return (infos[0] if infos else None), infos


def cmd_inspect(tok):
    aid = find_app(tok)
    print("app id:", aid)
    vers = get(tok, f"/apps/{aid}/appStoreVersions", {"limit": 20, "filter[platform]": "IOS"})["data"]
    print("\n== appStoreVersions ==")
    for v in vers:
        print(f"  {v['attributes']['versionString']}  {v['attributes']['appStoreState']}  id={v['id']}")
    edv, _ = editable_version(tok, aid, "1.3.0")
    if edv:
        locs = get(tok, f"/appStoreVersions/{edv['id']}/appStoreVersionLocalizations", {"limit": 50})["data"]
        print(f"\n== editable version {edv['attributes']['versionString']} localizations ==")
        for l in locs:
            print(f"  {l['attributes']['locale']}  id={l['id']}")
    print("\n== appInfos ==")
    inf, infos = editable_appinfo(tok, aid)
    for i in infos:
        print(f"  appInfo id={i['id']} state={i['attributes'].get('appStoreState') or i['attributes'].get('state')}")
    if inf:
        ilocs = get(tok, f"/appInfos/{inf['id']}/appInfoLocalizations", {"limit": 50})["data"]
        print(f"  -> editable appInfo {inf['id']} localizations:")
        for l in ilocs:
            print(f"     {l['attributes']['locale']}  name={l['attributes'].get('name')!r}  sub={l['attributes'].get('subtitle')!r}")


def cmd_apply(tok, vstr):
    aid = find_app(tok)
    print("app id:", aid)
    edv, _ = editable_version(tok, aid, vstr, create=True)
    vid = edv["id"]
    print("editable version:", edv["attributes"]["versionString"], vid)
    inf, _ = editable_appinfo(tok, aid)
    iid = inf["id"]
    ilocs = {l["attributes"]["locale"]: l for l in get(tok, f"/appInfos/{iid}/appInfoLocalizations", {"limit": 50})["data"]}
    vlocs = {l["attributes"]["locale"]: l for l in get(tok, f"/appStoreVersions/{vid}/appStoreVersionLocalizations", {"limit": 50})["data"]}
    for short, locale in LOC.items():
        m = META["locales"][short]
        # 1) name/subtitle (appInfoLocalizations)
        attrs = {"name": m["name"], "subtitle": m["subtitle"]}
        try:
            if locale in ilocs:
                patch(tok, f"/appInfoLocalizations/{ilocs[locale]['id']}", {"data": {"type": "appInfoLocalizations", "id": ilocs[locale]["id"], "attributes": attrs}})
                print(f"  [{locale}] appInfo PATCH name/subtitle ok")
            else:
                post(tok, "/appInfoLocalizations", {"data": {"type": "appInfoLocalizations", "attributes": {"locale": locale, **attrs}, "relationships": {"appInfo": {"data": {"type": "appInfos", "id": iid}}}}})
                print(f"  [{locale}] appInfo POST name/subtitle ok")
        except Exception as e:
            print(f"  [{locale}] appInfo ERROR: {e}")
        # 2) description/keywords/promotionalText/whatsNew (appStoreVersionLocalizations)
        vattrs = {"description": m["description"], "keywords": m["keywords"], "promotionalText": m["promotionalText"], "whatsNew": WHATSNEW[short]}
        try:
            if locale in vlocs:
                patch(tok, f"/appStoreVersionLocalizations/{vlocs[locale]['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": vlocs[locale]["id"], "attributes": vattrs}})
                print(f"  [{locale}] version PATCH desc/keywords/promo ok")
            else:
                post(tok, "/appStoreVersionLocalizations", {"data": {"type": "appStoreVersionLocalizations", "attributes": {"locale": locale, **vattrs}, "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
                print(f"  [{locale}] version POST desc/keywords/promo ok")
        except Exception as e:
            print(f"  [{locale}] version ERROR: {e}")
    print("apply done")


def main():
    op = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    tok = token()
    if op == "inspect":
        cmd_inspect(tok)
    elif op == "apply":
        cmd_apply(tok, sys.argv[2] if len(sys.argv) > 2 else "1.3.0")
    else:
        print("usage: asc_metadata.py inspect|apply [version]")


if __name__ == "__main__":
    main()

# App A 差分リリース: 変更18件のみの delta zip を生成し、フルパック(1002)とともに packs-appa-v2 へ公開。
# 現行=1001。delta は変更ファイルを32k化(ファイル毎min)して収録。catalog: audioVersion 1001→1002 + delta fields。
import os, json, subprocess, shutil, tempfile, urllib.request, zipfile
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 聞いて話せるネパール語
DIST = os.path.join(APP, "dist-packs")
REPO = "JinKato2020/safa-language-apps"; TAG = "packs-appa-v2"
BASE = f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
NEW_V, BASE_V = 1002, 1001
# delta-lang → (catalog位置key, フルzip名, 変更id一覧, masterのlangディレクトリ)
CH = {
  "core": {"zip":"audio-core.zip","ids":["16-1-15","26-1-3","3-1-13","8-1-14","17-3"],"adir":"ne"},
  "en":   {"zip":"audio-en.zip","ids":["1-1-7","1-3-10","1-3-11","1-3-8"],"adir":"en"},
  "ja":   {"zip":"audio-ja.zip","ids":["15-1-14","19-1-5","3-1-13","4-1-20","5-1-9","12-2","12-8","16-12","9-2"],"adir":"ja"},
}
def enc32k(src, dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg fail "+src)
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src  # per-file min

tmp=tempfile.mkdtemp(prefix="appa_delta_")
deltas={}
for key,info in CH.items():
    zp=os.path.join(DIST,f"delta-{key}.zip")
    with zipfile.ZipFile(zp,"w",zipfile.ZIP_STORED) as z:
        for _id in info["ids"]:
            sub = "conv" if _id.count("-")==2 else "gram"
            src=os.path.join(APP,"audio",info["adir"],sub,_id+".mp3")
            chosen=enc32k(src, os.path.join(tmp,f"{key}_{_id}.mp3"))
            z.write(chosen, _id+".mp3")
    deltas[key]=zp
    print(f"delta-{key}.zip: {len(info['ids'])}files {os.path.getsize(zp)/1024:.0f}KB")
shutil.rmtree(tmp,ignore_errors=True)

# catalog取得・更新
req=urllib.request.Request(BASE+"/catalog.json?t=delta",headers={"User-Agent":"appa"})
cat=json.loads(urllib.request.urlopen(req,timeout=30).read().decode("utf-8"))
def setd(entry,key):
    entry["audioVersion"]=NEW_V
    entry["audioZipBytes"]=os.path.getsize(os.path.join(DIST,CH[key]["zip"]))
    entry["deltaZip"]=f"{BASE}/delta-{key}.zip"
    entry["deltaZipBytes"]=os.path.getsize(deltas[key])
    entry["deltaBaseVersion"]=BASE_V
setd(cat["core"],"core")
for p in cat["packs"]:
    if p["l1"]=="en": setd(p,"en")
    if p["l1"]=="ja": setd(p,"ja")
cat_path=os.path.join(DIST,"catalog.json")
json.dump(cat,open(cat_path,"w",encoding="utf-8"),ensure_ascii=False,indent=2)
print("catalog: core/en/ja audioVersion->%d, deltaBaseVersion=%d" % (NEW_V,BASE_V))

# 公開: フルzip(更新) + delta + catalog
gh=shutil.which("gh")
assets=[os.path.join(DIST,n) for n in ("audio-core.zip","audio-en.zip","audio-ja.zip")] + list(deltas.values()) + [cat_path]
subprocess.run([gh,"release","upload",TAG,*assets,"--repo",REPO,"--clobber"],check=True)
print("公開完了: フル3 + delta3 + catalog →", TAG)

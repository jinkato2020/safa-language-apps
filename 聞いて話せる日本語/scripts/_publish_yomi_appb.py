# App B: 読み修正10件 + 例題変更29-1-19 を packs-appb-v2 へ差分公開(coreのみ)。
#  TEXT: core.json(examplesJp 29-1-19 + jpReading) version 1003->1004
#  AUDIO: ja(core) 11ファイル差し替え、full更新 + delta(11) audioVersion 1002->1003 deltaBase=1002
import os, json, shutil, subprocess, tempfile, urllib.request, zipfile, time
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST=os.path.join(APP,"dist-packs"); os.makedirs(DIST,exist_ok=True)
REPO="JinKato2020/safa-language-apps"; TAG="packs-appb-v2"
BASE=f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG=shutil.which("ffmpeg") or "ffmpeg"; GH=shutil.which("gh") or "gh"
TEXTV=1004; AUDIOV=1003; ABASE=1002
IDS=['4-2-6','6-2-1','6-2-5','8-2-6','10-2-9','10-2-10','12-1-5','15-1-9','25-1-19','26-1-15','29-1-19']
OLD_RD="スカイツリー高い。"; NEW_JP="スカイツリーは高いです。"
RD={"kana":"スカイツリーは たかいです。","romaji":"Sukaitsurii wa takai desu."}
def safe_replace(s,d):
    for a in range(8):
        try: os.replace(s,d); return
        except PermissionError: time.sleep(0.5*(a+1))
    os.replace(s,d)
def dl(n):
    p=os.path.join(DIST,n); urllib.request.urlretrieve(BASE+f"/{n}?t=yomi",p); return p
def rj(p): return json.load(open(p,encoding="utf-8"))
def wj(p,d): json.dump(d,open(p,"w",encoding="utf-8"),ensure_ascii=False)
def enc32k(src,dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg "+src)
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src

print("== download ==")
core=rj(dl("core.json")); cat=rj(dl("catalog.json")); dl("audio-core.zip")
print("== patch text ==")
core["examplesJp"]["29-1"][18]=NEW_JP
jr=core["jpReading"]; jr.pop(OLD_RD,None); jr[NEW_JP]=RD
wj(os.path.join(DIST,"core.json"),core)
print("== audio: swap 11 into full + delta ==")
tmp=tempfile.mkdtemp(prefix="yomiB_")
enc={}
for i in IDS:
    src=os.path.join(APP,"audio","ja","conv",i+".mp3")
    enc[i]=enc32k(src,os.path.join(tmp,i+".mp3"))
full=os.path.join(DIST,"audio-core.zip"); tmpfull=full+".new"; chg=set(x+".mp3" for x in IDS)
with zipfile.ZipFile(full) as zin, zipfile.ZipFile(tmpfull,"w",zipfile.ZIP_STORED) as zo:
    for it in zin.infolist():
        if it.filename in chg: continue
        zo.writestr(it, zin.read(it.filename))
    for i in IDS: zo.write(enc[i], i+".mp3")
safe_replace(tmpfull,full); fullbytes=os.path.getsize(full)
dz=os.path.join(DIST,"delta-core.zip")
with zipfile.ZipFile(dz,"w",zipfile.ZIP_STORED) as z:
    for i in IDS: z.write(enc[i], i+".mp3")
deltabytes=os.path.getsize(dz)
shutil.rmtree(tmp,ignore_errors=True)
print(f"  full audio-core.zip={fullbytes/1e6:.1f}MB  delta-core.zip={deltabytes}B ({len(IDS)}files)")
print("== catalog ==")
c=cat["core"]; c["version"]=TEXTV; c["audioVersion"]=AUDIOV; c["audioZipBytes"]=fullbytes
c["deltaZip"]=f"{BASE}/delta-core.zip"; c["deltaZipBytes"]=deltabytes; c["deltaBaseVersion"]=ABASE
catp=os.path.join(DIST,"catalog.json"); wj(catp,cat)
print(f"  core version={TEXTV} audioVersion={AUDIOV} deltaBase={ABASE}")
print("== upload ==")
assets=[os.path.join(DIST,n) for n in ("core.json","audio-core.zip","delta-core.zip","catalog.json")]
subprocess.run([GH,"release","upload",TAG,*assets,"--repo",REPO,"--clobber"],check=True)
print("done ->",TAG)

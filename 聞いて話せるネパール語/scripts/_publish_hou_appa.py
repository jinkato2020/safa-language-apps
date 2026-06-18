# App A ja「方→ほう」5件を packs-appa-v2 の ja パックへ差分公開(音声のみ・テキスト不変)。
#  pack[l1=ja]: audioVersion 1003->1004, deltaBase=1003。audio-ja.zip更新 + delta-ja.zip(5)。
import os, json, shutil, subprocess, tempfile, urllib.request, zipfile, time
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST=os.path.join(APP,"dist-packs"); os.makedirs(DIST,exist_ok=True)
REPO="JinKato2020/safa-language-apps"; TAG="packs-appa-v2"
BASE=f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG=shutil.which("ffmpeg") or "ffmpeg"; GH=shutil.which("gh") or "gh"
AUDIOV=1004; ABASE=1003
IDS=['1-3-16','10-3-8','14-3-2','15-3-7','22-12']
def safe_replace(s,d):
    for a in range(8):
        try: os.replace(s,d); return
        except PermissionError: time.sleep(0.5*(a+1))
    os.replace(s,d)
def dl(n):
    p=os.path.join(DIST,n); urllib.request.urlretrieve(BASE+f"/{n}?t=houA",p); return p
def enc32k(src,dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg "+src)
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src

print("== download ==")
cat=json.load(open(dl("catalog.json"),encoding="utf-8")); dl("audio-ja.zip")
print("== enc32k 5 ja ==")
tmp=tempfile.mkdtemp(prefix="houA_"); enc={}
for i in IDS:
    mode="conv" if i.count("-")==2 else "gram"
    enc[i]=enc32k(os.path.join(APP,"audio","ja",mode,i+".mp3"),os.path.join(tmp,i+".mp3"))
chg=set(i+".mp3" for i in IDS)
full=os.path.join(DIST,"audio-ja.zip"); tf=full+".new"
with zipfile.ZipFile(full) as zin, zipfile.ZipFile(tf,"w",zipfile.ZIP_STORED) as zo:
    for it in zin.infolist():
        if it.filename in chg: continue
        zo.writestr(it, zin.read(it.filename))
    for i in IDS: zo.write(enc[i], i+".mp3")
safe_replace(tf,full); fullb=os.path.getsize(full)
dz=os.path.join(DIST,"delta-ja.zip")
with zipfile.ZipFile(dz,"w",zipfile.ZIP_STORED) as z:
    for i in IDS: z.write(enc[i], i+".mp3")
deltab=os.path.getsize(dz); shutil.rmtree(tmp,ignore_errors=True)
print(f"  full={fullb/1e6:.1f}MB delta={deltab}B ({len(IDS)}files)")
print("== catalog ==")
for p in cat["packs"]:
    if p["l1"]=="ja":
        p["audioVersion"]=AUDIOV; p["audioZipBytes"]=fullb
        p["deltaZip"]=f"{BASE}/delta-ja.zip"; p["deltaZipBytes"]=deltab; p["deltaBaseVersion"]=ABASE
        print(f"  pack[ja] audioVersion={AUDIOV} deltaBase={ABASE} version={p.get('version')}(据置)")
catp=os.path.join(DIST,"catalog.json"); json.dump(cat,open(catp,"w",encoding="utf-8"),ensure_ascii=False)
print("== upload ==")
subprocess.run([GH,"release","upload",TAG,os.path.join(DIST,"audio-ja.zip"),dz,catp,"--repo",REPO,"--clobber"],check=True)
print("done ->",TAG)

# App C ja ヘテロニム12件を packs-appc の ja audio へ差分公開(音声のみ)。
#  audio[kind=ja]: audioVersion 2->3 + deltaZip/deltaBaseVersion=2 を付与。audio-ja.zip更新 + delta-ja.zip(12)。
import os, json, shutil, subprocess, tempfile, urllib.request, zipfile, time
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST=os.path.join(APP,"dist-packs"); os.makedirs(DIST,exist_ok=True)
REPO="JinKato2020/safa-language-apps"; TAG="packs-appc"
BASE=f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG=shutil.which("ffmpeg") or "ffmpeg"; GH=shutil.which("gh") or "gh"
NEWV=3; ABASE=2
IDS=['4-2-6','6-2-1','6-2-5','12-1-5','25-1-19','26-1-15','1-3-16','7-3-4','10-3-8','10-3-18','12-3-10','17-3-7']
def safe_replace(s,d):
    for a in range(8):
        try: os.replace(s,d); return
        except PermissionError: time.sleep(0.5*(a+1))
    os.replace(s,d)
def dl(n):
    p=os.path.join(DIST,n); urllib.request.urlretrieve(BASE+f"/{n}?t=houC",p); return p
def enc32k(src,dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg "+src)
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src

print("== download ==")
cat=json.load(open(dl("catalog.json"),encoding="utf-8")); dl("audio-ja.zip")
print("== enc32k 12 ja ==")
tmp=tempfile.mkdtemp(prefix="houC_"); enc={}
for i in IDS:
    mode="conv" if i.count("-")==2 else "gram"
    enc[i]=enc32k(os.path.join(APP,"audio","ja",mode,i+".mp3"),os.path.join(tmp,i+".mp3"))
chg=set(i+".mp3" for i in IDS)
full=os.path.join(DIST,"audio-ja.zip"); tf=full+".new"
with zipfile.ZipFile(full) as zin, zipfile.ZipFile(tf,"w",zipfile.ZIP_STORED) as zo:
    miss=[i for i in IDS if i+".mp3" not in set(zin.namelist())]
    if miss: print("  ※full未収録(新規追加):",miss)
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
for e in cat["audio"]:
    if e.get("kind")=="ja":
        e["audioVersion"]=NEWV; e["audioZipBytes"]=fullb
        e["deltaZip"]=f"{BASE}/delta-ja.zip"; e["deltaZipBytes"]=deltab; e["deltaBaseVersion"]=ABASE
        print(f"  audio[ja] audioVersion={NEWV} deltaBase={ABASE}")
catp=os.path.join(DIST,"catalog.json"); json.dump(cat,open(catp,"w",encoding="utf-8"),ensure_ascii=False)
print("== upload ==")
subprocess.run([GH,"release","upload",TAG,os.path.join(DIST,"audio-ja.zip"),dz,catp,"--repo",REPO,"--clobber"],check=True)
print("done ->",TAG)

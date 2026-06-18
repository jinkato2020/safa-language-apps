# App B ja「方→ほう」21件の音声を packs-appb-v2 core へ差分公開(音声のみ・テキスト不変)。
#  audioVersion 1003->1004, deltaBase=1003。conv/gram の ja を32k化し full更新 + delta(21)。
import os, json, shutil, subprocess, tempfile, urllib.request, zipfile, time
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST=os.path.join(APP,"dist-packs"); os.makedirs(DIST,exist_ok=True)
REPO="JinKato2020/safa-language-apps"; TAG="packs-appb-v2"
BASE=f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG=shutil.which("ffmpeg") or "ffmpeg"; GH=shutil.which("gh") or "gh"
AUDIOV=1004; ABASE=1003
IDS=['1-3-16','7-3-4','10-3-8','10-3-18','12-3-10','17-3-7',
     '18-1','18-2','18-4','18-6','18-7','18-8','18-9','18-11','18-12','18-14','18-15','18-16','18-18','18-19','18-20']
def safe_replace(s,d):
    for a in range(8):
        try: os.replace(s,d); return
        except PermissionError: time.sleep(0.5*(a+1))
    os.replace(s,d)
def dl(n):
    p=os.path.join(DIST,n); urllib.request.urlretrieve(BASE+f"/{n}?t=hou",p); return p
def enc32k(src,dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg "+src)
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src

print("== download ==")
cat=json.load(open(dl("catalog.json"),encoding="utf-8")); dl("audio-core.zip")
print("== enc32k 21 ja files ==")
tmp=tempfile.mkdtemp(prefix="houB_"); enc={}
for i in IDS:
    mode="conv" if i.count("-")==2 else "gram"
    src=os.path.join(APP,"audio","ja",mode,i+".mp3")
    enc[i]=enc32k(src,os.path.join(tmp,i+".mp3"))
chg=set(i+".mp3" for i in IDS)
full=os.path.join(DIST,"audio-core.zip"); tmpfull=full+".new"
with zipfile.ZipFile(full) as zin, zipfile.ZipFile(tmpfull,"w",zipfile.ZIP_STORED) as zo:
    for it in zin.infolist():
        if it.filename in chg: continue
        zo.writestr(it, zin.read(it.filename))
    for i in IDS: zo.write(enc[i], i+".mp3")
safe_replace(tmpfull,full); fullbytes=os.path.getsize(full)
dz=os.path.join(DIST,"delta-core.zip")
with zipfile.ZipFile(dz,"w",zipfile.ZIP_STORED) as z:
    for i in IDS: z.write(enc[i], i+".mp3")
deltabytes=os.path.getsize(dz); shutil.rmtree(tmp,ignore_errors=True)
print(f"  full={fullbytes/1e6:.1f}MB delta={deltabytes}B ({len(IDS)}files)")
print("== catalog ==")
c=cat["core"]; c["audioVersion"]=AUDIOV; c["audioZipBytes"]=fullbytes
c["deltaZip"]=f"{BASE}/delta-core.zip"; c["deltaZipBytes"]=deltabytes; c["deltaBaseVersion"]=ABASE
catp=os.path.join(DIST,"catalog.json"); json.dump(cat,open(catp,"w",encoding="utf-8"),ensure_ascii=False)
print(f"  core audioVersion={AUDIOV} deltaBase={ABASE} (text version={c.get('version')} 据置)")
print("== upload ==")
subprocess.run([GH,"release","upload",TAG,os.path.join(DIST,"audio-core.zip"),dz,catp,"--repo",REPO,"--clobber"],check=True)
print("done ->",TAG)

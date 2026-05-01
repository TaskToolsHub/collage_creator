import { useState, useEffect } from "react";
import { db, auth, RENDER_API_URL } from "../utils/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";

const MODELS = [
  { id: "sequence", name: "Sequence", icon: "movie" },
  { id: "slideshow", name: "Slideshow", icon: "slideshow" },
  { id: "fade", name: "Cinematic Fade", icon: "animation" },
  { id: "vertical", name: "Vertical (9:16)", icon: "smartphone" },
  { id: "pip", name: "Picture in Picture", icon: "picture_in_picture" }
];

export default function Dashboard({ user }) {
  const [tab, setTab] = useState("studio");
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("My Project");
  const [template, setTemplate] = useState("fade");
  const [files, setFiles] = useState([]);
  const [audioVoice, setAudioVoice] = useState(null);
  const [audioMusic, setAudioMusic] = useState(null);
  const [voiceVol, setVoiceVol] = useState(100);
  const [musicVol, setMusicVol] = useState(20);
  const [status, setStatus] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => { loadHistory(); }, [user, tab]);

  async function loadHistory() {
    try {
      const q = query(collection(db, "projects"), where("uid", "==", user.uid));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = Date.now();
      const WEEK = 7*24*60*60*1000;
      const valid = [];
      for (const d of docs) {
        if (d.createdAt && (now - d.createdAt.toMillis()) > WEEK) {
          try { await deleteDoc(doc(db, "projects", d.id)); } catch {}
        } else {
          valid.push(d);
        }
      }
      valid.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setHistory(valid);
    } catch (e) { console.error("History load error:", e); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setFiles(prev => [...prev, ...dropped]);
  }

  function removeFile(idx) { setFiles(prev => prev.filter((_, i) => i !== idx)); }

  async function handleGenerate() {
    if (!name.trim()) { alert("Enter a project name."); return; }
    if (!files.length) { alert("Add at least one media file."); return; }
    setStatus("generating"); setVideoUrl(null); setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("projectName", name.trim());
      fd.append("template", template);
      fd.append("uid", user.uid);
      fd.append("voiceVolume", voiceVol / 100);
      fd.append("musicVolume", musicVol / 100);
      files.forEach(f => fd.append("media", f));
      if (audioVoice) fd.append("voice", audioVoice);
      if (audioMusic) fd.append("music", audioMusic);

      const res = await fetch(RENDER_API_URL + "/render", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setVideoUrl(URL.createObjectURL(blob));
      setStatus("done");
      
      await addDoc(collection(db, "projects"), {
        uid: user.uid, name: name.trim(), template, mediaCount: files.length,
        hasVoice: !!audioVoice, hasMusic: !!audioMusic, createdAt: serverTimestamp()
      });
      loadHistory();
    } catch (e) { console.error(e); setStatus("error"); setErrorMsg(e.message); }
  }

  return (
    <div className="bg-[#0A0A0A] text-[#e5e2e1] min-h-screen flex flex-col font-['Inter'] overflow-hidden">
      <header className="bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/10 shadow-2xl fixed top-0 left-0 z-50 flex justify-between items-center w-full px-6 h-16">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-black tracking-tighter text-white uppercase">AI Video Studio</h1>
          <div className="hidden md:flex items-center bg-white/5 border border-[#2A2A2A] rounded-lg px-3 py-1.5 gap-2 w-64">
            <span className="material-symbols-outlined text-neutral-500 text-sm">search</span>
            <input className="bg-transparent border-none focus:outline-none text-xs text-[#e5e2e1] placeholder-neutral-500 w-full" placeholder="Search assets..." />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input type="text" value={name} onChange={e=>setName(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#007AFF]" placeholder="Project Name" />
          <button className="text-white bg-[#007AFF] px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors active:scale-95 duration-200" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </header>

      <div className="flex pt-16 h-screen">
        <aside className="bg-[#121212] border-r border-white/10 fixed left-0 top-16 h-full flex flex-col py-6 w-64 z-40">
          <div className="px-6 mb-10 flex flex-col gap-1">
            <span className="text-white font-bold uppercase text-xs tracking-widest">Studio Workspace</span>
            <span className="text-[10px] text-[#007AFF] font-bold uppercase tracking-widest">Pro Plan</span>
          </div>
          <nav className="flex-1 flex flex-col gap-2">
            <button onClick={() => setTab("studio")} className={`flex items-center gap-3 px-4 py-3 uppercase text-xs font-bold tracking-widest transition-all ${tab === "studio" ? "bg-[#007AFF]/10 text-[#007AFF] border-r-4 border-[#007AFF]" : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"}`}>
              <span className="material-symbols-outlined">movie_filter</span> Studio
            </button>
            <button onClick={() => setTab("history")} className={`flex items-center gap-3 px-4 py-3 uppercase text-xs font-bold tracking-widest transition-all ${tab === "history" ? "bg-[#007AFF]/10 text-[#007AFF] border-r-4 border-[#007AFF]" : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"}`}>
              <span className="material-symbols-outlined">history</span> History
            </button>
          </nav>
        </aside>

        <main className="ml-64 flex-1 p-6 bg-[#0A0A0A] overflow-y-auto pb-32">
          {tab === "studio" && (
            <div className="grid grid-cols-12 gap-6 h-full">
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                <section className="glass-panel p-6 rounded-xl flex flex-col gap-6 border border-white/10 bg-[#1E1E1E]/60">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#007AFF]">graphic_eq</span> Audio Mixing
                    </h2>
                    <span className="text-[10px] bg-[#2A2A2A] px-2 py-0.5 rounded text-neutral-400">48KHZ / 24-BIT</span>
                  </div>
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2 relative">
                        <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setAudioVoice(e.target.files[0])} />
                        <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all ${audioVoice ? 'border-[#007AFF] bg-[#007AFF]/10' : 'border-white/10 hover:border-[#007AFF]/50'}`}>
                          <span className="material-symbols-outlined text-[#007AFF]">{audioVoice ? 'check_circle' : 'mic'}</span>
                          <span className="text-xs text-neutral-400">{audioVoice ? audioVoice.name.substring(0,10)+'...' : 'Upload Voice'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 relative">
                        <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setAudioMusic(e.target.files[0])} />
                        <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all ${audioMusic ? 'border-[#2ae500] bg-[#2ae500]/10' : 'border-white/10 hover:border-[#2ae500]/50'}`}>
                          <span className="material-symbols-outlined text-[#2ae500]">{audioMusic ? 'check_circle' : 'music_note'}</span>
                          <span className="text-xs text-neutral-400">{audioMusic ? audioMusic.name.substring(0,10)+'...' : 'Upload Music'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1 font-bold">
                          <span className="text-neutral-500 uppercase tracking-widest">Voice Volume</span>
                          <span className="text-[#007AFF]">{voiceVol}%</span>
                        </div>
                        <input type="range" className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#007AFF]" value={voiceVol} onChange={e=>setVoiceVol(e.target.value)} />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1 font-bold">
                          <span className="text-neutral-500 uppercase tracking-widest">Music Volume</span>
                          <span className="text-[#2ae500]">{musicVol}%</span>
                        </div>
                        <input type="range" className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#2ae500]" value={musicVol} onChange={e=>setMusicVol(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="glass-panel p-6 rounded-xl flex flex-col gap-4 border border-white/10 bg-[#1E1E1E]/60">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#2ae500]">auto_videocam</span> Motion Models
                    </h2>
                    <select className="bg-[#1A1A1A] border border-white/10 text-white text-xs rounded px-3 py-2 outline-none focus:border-[#007AFF]" value={template} onChange={e => setTemplate(e.target.value)}>
                      {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  
                  <div 
                    className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${dragging ? 'border-[#007AFF] bg-[#007AFF]/10' : 'border-white/10 bg-[#1A1A1A] hover:border-white/30'}`}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('mediaInput').click()}
                  >
                    <span className="material-symbols-outlined text-4xl text-neutral-500 mb-2">add_photo_alternate</span>
                    <span className="text-sm font-bold text-neutral-300">Drag & Drop Media</span>
                    <span className="text-xs text-neutral-500 mt-1">or click to browse</span>
                    <input id="mediaInput" type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => setFiles([...files, ...Array.from(e.target.files)])} />
                  </div>

                  {files.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto py-2">
                      {files.map((f, i) => (
                        <div key={i} className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                          {f.type.startsWith('video') ? <div className="w-full h-full bg-[#2A2A2A] flex items-center justify-center text-white font-bold text-xl">V</div> : <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />}
                          <button onClick={(e) => {e.stopPropagation(); removeFile(i)}} className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">X</button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="col-span-12 lg:col-span-7 flex flex-col">
                <div className="glass-panel flex-1 rounded-xl relative overflow-hidden bg-black flex items-center justify-center border border-[#2A2A2A]">
                  <div className={`relative ${template === 'vertical' ? 'h-[90%] aspect-[9/16]' : 'w-[90%] aspect-video'} bg-[#0A0A0A] shadow-[0_0_50px_rgba(0,0,0,1)] rounded-lg overflow-hidden flex items-center justify-center`}>
                    {status === "generating" && <div className="flex flex-col items-center text-[#007AFF]"><span className="material-symbols-outlined text-5xl animate-spin mb-4">sync</span><span className="font-bold text-sm tracking-widest uppercase animate-pulse">Rendering UltraFast...</span></div>}
                    {status === "error" && <div className="text-red-500 text-sm p-4 text-center border border-red-500/50 rounded bg-red-500/10 mx-4">{errorMsg}</div>}
                    {status === "done" && videoUrl && <video src={videoUrl} controls className="w-full h-full object-contain" autoPlay />}
                    {!status && !videoUrl && <div className="text-neutral-600 text-sm tracking-widest uppercase flex flex-col items-center gap-2"><span className="material-symbols-outlined text-4xl">preview</span>Live Preview Ready</div>}
                  </div>
                </div>
                {status !== "generating" && (
                  <div className="fixed bottom-10 right-10 z-50">
                    <button onClick={handleGenerate} className="bg-[#2ae500] text-[#053900] px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm flex items-center gap-3 shadow-[0_0_30px_rgba(42,229,0,0.4)] hover:scale-105 active:scale-95 transition-all">
                      <span className="material-symbols-outlined">auto_fix_high</span> Create Collage
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "history" && (
            <div>
              <div className="mb-10">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tighter">Project History</h1>
                <p className="text-neutral-400 text-sm">Manage your saved video collages (auto-delete 7 days).</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {history.map(p => (
                  <div key={p.id} className="group flex flex-col bg-[#1c1b1b] border border-white/10 rounded-xl overflow-hidden hover:border-[#007AFF]/50 transition-all duration-300 shadow-xl">
                    <div className="aspect-[9/16] relative bg-black flex items-center justify-center">
                       <span className="material-symbols-outlined text-neutral-800 text-6xl group-hover:scale-110 transition-transform">movie</span>
                       <div className="absolute top-3 left-3 px-2 py-1 bg-[#2ae500]/20 backdrop-blur-md rounded text-[10px] font-bold text-[#2ae500] tracking-widest flex items-center gap-1 border border-[#2ae500]/20">SAVED</div>
                    </div>
                    <div className="p-4 flex flex-col h-full bg-[#121212]">
                      <h3 className="font-bold text-sm text-white mb-2 truncate">{p.name}</h3>
                      <div className="flex items-center gap-2 text-neutral-500 text-[10px] uppercase font-mono mb-4">
                        <span className="material-symbols-outlined text-xs">category</span> {p.template} <span className="mx-1">•</span> {p.mediaCount || 0} MEDIA
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <button onClick={() => deleteDoc(doc(db,"projects",p.id)).then(loadHistory)} className="col-span-2 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#FF0000]/10 border border-[#FF0000]/20 text-xs font-bold text-[#FF4444] hover:bg-[#FF0000]/20 transition-all">
                          <span className="material-symbols-outlined text-sm">delete</span> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {history.length === 0 && <div className="col-span-full text-center py-20 text-neutral-500 border border-dashed border-white/10 rounded-xl">No projects in history.</div>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

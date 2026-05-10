import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, storage, RENDER_API_URL } from "../utils/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import {
  Clapperboard,
  History,
  Search,
  Trash2,
  Play,
  Pencil,
  Check,
  X,
  Plus,
  Video,
  UploadCloud,
  Music,
  Mic,
  Settings,
  Sparkles,
  Smartphone,
  Navigation,
  Film,
  Server,
  Loader2,
  LogOut
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MODELS = [
  { id: "social", name: "Social Masterpiece", icon: Sparkles },
  { id: "fade", name: "Cinematic Fade", icon: Film },
  { id: "panning", name: "Pan & Zoom Pro", icon: Navigation },
  { id: "vertical", name: "Vertical (9:16)", icon: Smartphone },
  { id: "sequence", name: "Sequence", icon: Clapperboard }
];

export default function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('studio');
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // History tab state
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLink, setEditLink] = useState('');
  const [playingId, setPlayingId] = useState(null);

  // Studio tab state
  const [template, setTemplate] = useState('social');
  const [projectName, setProjectName] = useState('New Project');
  const [videoText, setVideoText] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [voiceFile, setVoiceFile] = useState(null);
  const [musicFile, setMusicFile] = useState(null);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.2);

  // Connection and Generation state
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('backendUrl') || RENDER_API_URL + '/render');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    localStorage.setItem('backendUrl', backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    loadHistory();
  }, [user, activeTab]);

  const loadHistory = async () => {
    try {
      const q = query(collection(db, "projects"), where("uid", "==", user.uid));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Auto-delete older than 7 days
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
      setProjects(valid);
    } catch (e) {
      console.error("History load error:", e);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.referenceLink || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this video?')) {
      try {
        await deleteDoc(doc(db, "projects", id));
        setProjects(projects.filter(p => p.id !== id));
        if (playingId === id) setPlayingId(null);
      } catch (e) {
        alert("Error deleting project.");
      }
    }
  };

  const startEditing = (project) => {
    setEditingId(project.id);
    setEditTitle(project.name);
    setEditDescription(project.description || '');
    setEditLink(project.referenceLink || '');
  };

  const saveEditing = async (id) => {
    try {
      await updateDoc(doc(db, "projects", id), {
        name: editTitle,
        description: editDescription,
        referenceLink: editLink
      });
      setProjects(projects.map(p => 
        p.id === id 
          ? { ...p, name: editTitle, description: editDescription, referenceLink: editLink } 
          : p
      ));
      setEditingId(null);
    } catch (e) {
      alert("Error updating project.");
    }
  };

  const handlePlay = (id) => {
    setPlayingId(playingId === id ? null : id);
  };

  const handleMediaUpload = (e) => {
    if (e.target.files) {
      setMediaFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleGenerate = async () => {
    if (mediaFiles.length === 0) return;
    if (!backendUrl) {
      alert("Please configure the Backend URL first.");
      return;
    }

    setIsGenerating(true);
    setVideoUrl(null);
    try {
      const formData = new FormData();
      formData.append("projectName", projectName);
      formData.append("template", template);
      formData.append("uid", user.uid);
      formData.append("voiceVolume", voiceVolume.toString());
      formData.append("musicVolume", musicVolume.toString());
      formData.append("videoText", videoText);
      
      mediaFiles.forEach(file => formData.append("media", file));
      if (voiceFile) formData.append("voice", voiceFile);
      if (musicFile) formData.append("music", musicFile);

      const response = await fetch(backendUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const blob = await response.blob();
      const generatedUrl = URL.createObjectURL(blob);
      setVideoUrl(generatedUrl);
      
      let downloadURL = null;
      try {
        const storageRef = ref(storage, `videos/${user.uid}/${Date.now()}_${projectName.replace(/ /g, "_")}.mp4`);
        await uploadBytes(storageRef, blob);
        downloadURL = await getDownloadURL(storageRef);
      } catch (storageError) {
        console.warn("Storage upload skipped or failed:", storageError);
      }
      
      await addDoc(collection(db, "projects"), {
        uid: user.uid,
        name: projectName,
        template: template.toUpperCase(),
        mediaCount: mediaFiles.length,
        status: 'SAVED',
        description: '',
        referenceLink: '',
        videoUrl: downloadURL,
        createdAt: serverTimestamp()
      });
      
      loadHistory();
      setActiveTab('studio'); // Keep user on studio to watch the video
      
    } catch (error) {
      console.error("Generate error:", error);
      alert("Failed to render video. " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0E0E0E] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#141414] border-r border-[#2A2A2A] flex flex-col flex-shrink-0 relative z-20">
        <div className="p-6 h-20 flex items-center">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
             AI VIDEO STUDIO
          </h1>
        </div>

        <div className="px-6 py-4">
          <h2 className="text-[10px] font-bold text-gray-400 tracking-wider mb-1 uppercase">Studio Workspace</h2>
          <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Pro Plan</span>
        </div>

        <nav className="mt-4 flex-1">
          <ul>
            <li>
              <button 
                onClick={() => setActiveTab('studio')}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                  activeTab === 'studio' 
                    ? "bg-[#1C2532] text-blue-400 border-r-2 border-blue-500" 
                    : "text-gray-400 hover:text-white hover:bg-[#1A1A1A]"
                )}
              >
                <Clapperboard size={18} />
                STUDIO
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                  activeTab === 'history' 
                    ? "bg-[#1C2532] text-blue-400 border-r-2 border-blue-500" 
                    : "text-gray-400 hover:text-white hover:bg-[#1A1A1A]"
                )}
              >
                <History size={18} />
                HISTORY
              </button>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t border-[#2A2A2A]">
           <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">
             <LogOut size={16} /> LOGOUT
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-[#2A2A2A] bg-[#0E0E0E] flex items-center px-8 z-20">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search assets (projects, descriptions)..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (activeTab !== 'history') setActiveTab('history');
              }}
              className="w-full bg-[#1A1A1A] border border-[#333] text-sm text-white rounded-md py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'history' && (
            <div className="max-w-6xl">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Project History</h2>
                <p className="text-gray-400">Manage your saved video collages (auto-delete 7 days).</p>
                {searchTerm && (
                  <p className="text-blue-400 mt-2 text-sm">Showing results for: "{searchTerm}"</p>
                )}
              </div>

              {filteredProjects.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  No projects found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProjects.map((project) => (
                    <div key={project.id} className="bg-[#18181B] rounded-xl border border-[#27272A] overflow-hidden flex flex-col group">
                      <div className="relative aspect-[9/16] bg-black flex items-center justify-center border-b border-[#27272A]">
                        <div className="absolute top-3 left-3 bg-green-900/30 text-green-400 text-[10px] font-bold px-2 py-1 rounded border border-green-500/20 tracking-widest">
                          SAVED
                        </div>
                        
                        {playingId === project.id && project.videoUrl ? (
                          <video 
                            src={project.videoUrl} 
                            controls 
                            autoPlay 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <>
                            <Clapperboard size={48} className="text-[#333] group-hover:text-[#444] transition-colors" />
                            {project.videoUrl && (
                              <div 
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                onClick={() => handlePlay(project.id)}
                              >
                                <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                                  <Play size={32} className="text-white fill-white ml-1" />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        {editingId === project.id ? (
                          <div className="space-y-3 mb-4 flex-1">
                             <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-[#27272A] border border-[#3F3F46] rounded px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-blue-500"
                                placeholder="Project Title"
                                autoFocus
                             />
                             <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="w-full bg-[#27272A] border border-[#3F3F46] rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 resize-none h-16"
                                placeholder="Description (optional)"
                             />
                             <input
                                type="text"
                                value={editLink}
                                onChange={(e) => setEditLink(e.target.value)}
                                className="w-full bg-[#27272A] border border-[#3F3F46] rounded px-3 py-1.5 text-xs text-blue-400 focus:outline-none focus:border-blue-500"
                                placeholder="Reference Link (optional)"
                             />
                             <div className="flex gap-2">
                               <button onClick={() => saveEditing(project.id)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors">
                                 <Check size={14} /> Save
                               </button>
                               <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors">
                                 <X size={14} /> Cancel
                               </button>
                             </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-1 group/title">
                              <h3 className="font-bold text-sm leading-tight truncate pr-2 uppercase tracking-tighter">{project.name}</h3>
                              <button 
                                onClick={() => startEditing(project)}
                                className="text-gray-500 hover:text-white opacity-0 group-hover/title:opacity-100 transition-opacity p-1 bg-[#27272A] rounded"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3 font-bold uppercase tracking-widest">
                              <span className="flex items-center gap-1 text-blue-500"><Video size={10}/> {project.template}</span>
                              <span>•</span>
                              <span>{project.mediaCount} MEDIA</span>
                            </div>

                            {(project.description || project.referenceLink) && (
                              <div className="bg-[#1f1f23] rounded p-2 mb-3 text-[10px] flex-1 border border-white/5">
                                {project.description && <p className="text-gray-400 mb-1 line-clamp-2">{project.description}</p>}
                                {project.referenceLink && (
                                  <a href={project.referenceLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1 truncate w-full">
                                    🔗 Link
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {!project.description && !project.referenceLink && <div className="flex-1"></div>}
                          </>
                        )}

                        {editingId !== project.id && (
                          <div className="flex gap-2 mt-auto pt-3 border-t border-[#27272A]">
                            <button 
                              onClick={() => handlePlay(project.id)}
                              className={cn(
                                "flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                                playingId === project.id 
                                  ? "bg-[#27272A] text-white hover:bg-[#3F3F46]" 
                                  : "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-900/50 hover:border-blue-700 w-full"
                              )}
                            >
                              {playingId === project.id ? "Stop" : <><Play size={14} className="fill-current" /> Play</>}
                            </button>
                            <button 
                              onClick={() => handleDelete(project.id)}
                              className="flex-1 bg-red-950/20 border border-red-900/30 hover:bg-red-900/40 text-red-500 py-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'studio' && (
            <div className="max-w-6xl">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 tracking-tighter">Studio Workspace</h2>
                <p className="text-gray-400">Configure your video template, upload media, and generate your collage.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                 {/* Left Column: Media & Template */}
                 <div className="md:col-span-8 space-y-6">
                    {/* Preview Area */}
                    <div className="bg-black rounded-xl border border-[#27272A] aspect-video relative overflow-hidden flex items-center justify-center shadow-2xl">
                       {isGenerating ? (
                         <div className="flex flex-col items-center gap-4">
                           <Loader2 size={48} className="text-blue-500 animate-spin" />
                           <p className="text-sm font-bold text-blue-400 animate-pulse tracking-widest uppercase">Rendering UltraFast...</p>
                         </div>
                       ) : videoUrl ? (
                         <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
                       ) : (
                         <div className="text-center">
                            <Play size={48} className="mx-auto text-[#1A1A1A] mb-4" />
                            <p className="text-xs text-gray-600 font-bold tracking-widest uppercase">Live Preview Ready</p>
                         </div>
                       )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                        <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Project Name</label>
                        <input 
                          type="text" 
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="w-full bg-[#27272A] border border-[#3F3F46] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                        <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest flex items-center gap-2">Text Overlay (Opt)</label>
                        <input 
                          type="text" 
                          value={videoText}
                          onChange={(e) => setVideoText(e.target.value)}
                          className="w-full bg-[#27272A] border border-[#3F3F46] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                          placeholder="es. Link o Titolo"
                        />
                      </div>
                      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                         <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest flex items-center gap-2"><Server size={14}/> Backend IP/URL</label>
                         <input 
                           type="text" 
                           value={backendUrl}
                           onChange={(e) => setBackendUrl(e.target.value)}
                           className="w-full bg-[#27272A] border border-[#3F3F46] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                           placeholder="http://192.168.1.X:10000/render"
                         />
                      </div>
                    </div>

                    {/* Template Selection */}
                    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                      <label className="block text-[10px] font-bold text-gray-500 mb-4 uppercase tracking-widest">Motion Models</label>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {MODELS.map(m => {
                          const Icon = m.icon;
                          const isActive = template === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => setTemplate(m.id)}
                              className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-lg border transition-all",
                                isActive 
                                  ? "bg-blue-900/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                                  : "bg-[#27272A] border-[#3F3F46] text-gray-400 hover:text-white"
                              )}
                            >
                              <Icon size={20} className="mb-2" />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">{m.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Media Upload */}
                    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                      <label className="block text-[10px] font-bold text-gray-500 mb-4 uppercase tracking-widest">Visual Media ({mediaFiles.length})</label>
                      
                      <div className="border-2 border-dashed border-[#3F3F46] rounded-xl p-8 hover:border-blue-500 transition-all bg-[#27272A]/30 text-center relative group">
                        <UploadCloud size={48} className="mx-auto text-gray-600 mb-4 group-hover:text-blue-500 transition-colors" />
                        <h3 className="text-sm font-bold mb-1">Drag and drop images or videos</h3>
                        <p className="text-gray-500 text-[10px] mb-4">Multipart-data generation</p>
                        <button className="bg-[#3F3F46] hover:bg-[#4F4F56] text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors">Browse</button>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*,video/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleMediaUpload}
                        />
                      </div>
                      
                      {mediaFiles.length > 0 && (
                        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                           {mediaFiles.map((f, i) => (
                             <div key={i} className="flex-shrink-0 w-16 h-16 bg-[#27272A] border border-white/5 rounded-lg flex items-center justify-center text-[8px] overflow-hidden relative group">
                                <span className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer text-white font-black transition-opacity" onClick={() => setMediaFiles(mediaFiles.filter((_, idx) => idx !== i))}>X</span>
                                <span className="truncate px-2 text-neutral-400">{f.name}</span>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                 </div>

                 {/* Right Column: Audio & Generate */}
                 <div className="md:col-span-4 space-y-6">
                    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                       <h3 className="text-[10px] font-bold text-gray-500 mb-6 uppercase tracking-widest flex items-center gap-2"><Mic size={14} className="text-blue-500"/> Voice Layer</h3>
                       <div className="mb-6">
                         <div className="bg-[#27272A] border border-[#3F3F46] hover:border-blue-500 rounded-xl p-4 text-center transition-all text-xs font-bold uppercase tracking-widest relative overflow-hidden">
                           {voiceFile ? <span className="text-blue-400">{voiceFile.name.substring(0,15)}...</span> : "Upload Voice"}
                           <input 
                             type="file" 
                             accept="audio/*" 
                             className="absolute inset-0 opacity-0 cursor-pointer" 
                             onChange={(e) => setVoiceFile(e.target.files?.[0] || null)} 
                           />
                         </div>
                         {voiceFile && (
                           <button onClick={() => setVoiceFile(null)} className="text-red-500 text-[10px] mt-2 font-bold hover:underline uppercase relative z-10">Remove</button>
                         )}
                       </div>
                       
                       <div className="space-y-2">
                         <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            <span>Level</span>
                            <span className="text-blue-400">{Math.round(voiceVolume * 100)}%</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" max="2" step="0.1" 
                           value={voiceVolume} 
                           onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                           className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                         />
                       </div>
                    </div>

                    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
                       <h3 className="text-[10px] font-bold text-gray-500 mb-6 uppercase tracking-widest flex items-center gap-2"><Music size={14} className="text-green-500"/> Music Layer</h3>
                       <div className="mb-6">
                         <div className="bg-[#27272A] border border-[#3F3F46] hover:border-blue-500 rounded-xl p-4 text-center transition-all text-xs font-bold uppercase tracking-widest relative overflow-hidden">
                           {musicFile ? <span className="text-green-400">{musicFile.name.substring(0,15)}...</span> : "Upload Music"}
                           <input 
                             type="file" 
                             accept="audio/*" 
                             className="absolute inset-0 opacity-0 cursor-pointer" 
                             onChange={(e) => setMusicFile(e.target.files?.[0] || null)} 
                           />
                         </div>
                         {musicFile && (
                           <button onClick={() => setMusicFile(null)} className="text-red-500 text-[10px] mt-2 font-bold hover:underline uppercase relative z-10">Remove</button>
                         )}
                       </div>
                       
                       <div className="space-y-2">
                         <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            <span>Level</span>
                            <span className="text-green-400">{Math.round(musicVolume * 100)}%</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" max="1" step="0.05" 
                           value={musicVolume} 
                           onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                           className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-green-500" 
                         />
                       </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={handleGenerate}
                        disabled={mediaFiles.length === 0 || isGenerating}
                        className={cn(
                          "w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all",
                          mediaFiles.length > 0 && !isGenerating
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:scale-[1.02] active:scale-95" 
                            : "bg-[#27272A] text-gray-600 cursor-not-allowed"
                        )}>
                        {isGenerating ? (
                          <>
                            <Loader2 size={20} className="animate-spin" /> Rendering...
                          </>
                        ) : (
                          <>
                            <Sparkles size={20} /> Create Collage
                          </>
                        )}
                      </button>
                      
                      {videoUrl && !isGenerating && (
                        <a 
                          href={videoUrl} 
                          download={`${projectName.replace(/ /g, "_")}.mp4`}
                          className="w-full mt-4 py-4 rounded-2xl bg-green-600/10 border border-green-500/20 text-green-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-600/20 transition-all shadow-lg"
                        >
                          <Play size={16} className="fill-current"/> Save To Device
                        </a>
                      )}
                    </div>
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

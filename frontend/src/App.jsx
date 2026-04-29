import { useState, useEffect } from "react";
import { auth } from "./utils/firebase";
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);
  if (loading) return (<div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", color: "#00d4a8", fontSize: "0.8rem", letterSpacing: "0.3em" }}>INITIALIZING...</div>);
  if (!user) return <LoginScreen />;
  return <Dashboard user={user} />;
}

function LoginScreen() {
  const [busy, setBusy] = useState(false);
  async function handleGoogle() {
    setBusy(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { alert("Errore login: " + e.message); setBusy(false); }
  }
  async function handleAnon() {
    setBusy(true);
    try { await signInAnonymously(auth); }
    catch (e) { alert("Errore: " + e.message); setBusy(false); }
  }
  return (
    <div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", padding: "2rem" }}>
      <div style={{ maxWidth: 380, width: "100%", border: "1px solid rgba(0,212,168,0.2)", borderRadius: "12px", padding: "2.5rem", background: "#0a0f18", textAlign: "center" }}>
        <div style={{ fontSize: "0.6rem", color: "#00d4a8", letterSpacing: "0.3em", marginBottom: "0.5rem" }}>TASKTOOLS HUB</div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f8fafc", margin: "0 0 0.3rem" }}>COLLAGE <span style={{ color: "#00d4a8" }}>CREATOR</span></h1>
        <p style={{ fontSize: "0.6rem", color: "#475569", marginBottom: "2rem" }}>Open Source</p>
        <button onClick={handleGoogle} disabled={busy} style={{ width: "100%", padding: "0.8rem", background: "rgba(0,212,168,0.1)", border: "1px solid rgba(0,212,168,0.4)", color: "#00d4a8", borderRadius: "6px", fontSize: "0.7rem", cursor: busy ? "not-allowed" : "pointer", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: "0.8rem" }}>{busy ? "..." : "G  ACCEDI CON GOOGLE"}</button>
        <button onClick={handleAnon} disabled={busy} style={{ width: "100%", padding: "0.6rem", background: "transparent", border: "1px solid #1e293b", color: "#475569", borderRadius: "6px", fontSize: "0.6rem", cursor: busy ? "not-allowed" : "pointer", fontFamily: "'Courier New', monospace" }}>ACCESSO ANONIMO (demo)</button>
        <p style={{ fontSize: "0.5rem", color: "#334155", marginTop: "1.5rem" }}>MIT License - github.com/TaskToolsHub</p>
      </div>
    </div>
  );
}

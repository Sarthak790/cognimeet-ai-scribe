"use client";

import { useState, useEffect } from "react";

export default function Home() {
  // --- AUTH STATES ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // --- APP STATES ---
  const [meetUrl, setMeetUrl] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error" | "loading" | "">("");
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  
  // --- UI STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check for existing login token on load
  useEffect(() => {
    const token = localStorage.getItem("scribe_token");
    if (token) {
      setIsAuthenticated(true);
      loadSummaries(token);
    }
  }, []);

  // --- AUTHENTICATION HANDLER ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = authMode === "login" ? "/login" : "/signup";

    try {
      const res = await fetch(`https://cognimeet-ai-scribe.onrender.com${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem("scribe_token", data.token);
        setIsAuthenticated(true);
        loadSummaries(data.token);
      } else {
        setAuthError(data.detail || data.error || "Authentication failed.");
      }
    } catch {
      setAuthError("Failed to connect to the server.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("scribe_token");
    setIsAuthenticated(false);
    setSummaries([]);
  };

  // --- BOT HANDLERS ---
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusType("loading");
    setStatusMsg("Deploying bot to the meeting…");

    const token = localStorage.getItem("scribe_token");

    try {
      const res = await fetch("https://cognimeet-ai-scribe.onrender.com/deploy-bot", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ url: meetUrl }),
      });
      const data = await res.json();
      setStatusType("success");
      setStatusMsg(data.message || "Bot deployed successfully!");
      setMeetUrl("");
    } catch {
      setStatusType("error");
      setStatusMsg("Failed to connect to the backend.");
    }
    setLoading(false);
  };

  const loadSummaries = async (tokenOverride?: string) => {
    setFetching(true);
    const token = tokenOverride || localStorage.getItem("scribe_token");
    
    try {
      const res = await fetch("https://cognimeet-ai-scribe.onrender.com/summaries", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.summaries) setSummaries(data.summaries);
    } catch {
      console.error("Failed to load summaries");
    }
    setFetching(false);
  };

  const downloadTxt = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(".txt", "") + "_Summary.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const latestSummary = summaries.length > 0 ? summaries[0] : null;
  const pastSummaries = summaries.length > 1 ? summaries.slice(1) : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500&display=swap');
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
          color: #0f172a;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
        }

        /* --- MATERIAL ICONS GLOBAL FIX --- */
        .mi {
          font-family: 'Material Icons Round';
          font-weight: normal; font-style: normal; display: inline-block;
          line-height: 1; text-transform: none; letter-spacing: normal;
          word-wrap: normal; white-space: nowrap; direction: ltr;
          -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
          -moz-osx-font-smoothing: grayscale; font-feature-settings: 'liga';
        }

        /* --- VIBRANT EMERALD THEME: #10b981 --- */
        .topbar {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #e2e8f0;
          height: 72px; display: flex; align-items: center;
          padding: 0 32px; gap: 12px; position: sticky; top: 0; z-index: 100;
          transition: all 0.3s ease;
        }

        .topbar-title { font-size: 24px; font-weight: 500; color: #64748b; letter-spacing: -0.5px; }
        .topbar-title span { color: #10b981; font-weight: 800; }
        .topbar-spacer { flex: 1; }

        .meet-icon svg { width: 36px; height: 36px; display: block; animation: scaleIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; transition: transform 0.3s ease; }
        .meet-icon:hover svg { transform: rotate(-10deg) scale(1.1); }

        .gm-main { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }

        .gm-hero { text-align: center; padding: 48px 0 40px; animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .gm-hero h1 { 
          font-size: 56px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 16px; 
          background: linear-gradient(135deg, #059669 0%, #34d399 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .gm-hero p { font-size: 18px; color: #64748b; max-width: 540px; margin: 0 auto; line-height: 1.7; font-weight: 500; }

        .gm-card {
          background: #ffffff; border-radius: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }

        .gm-card:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
        }

        /* AUTH STYLES */
        .auth-container { max-width: 440px; margin: 40px auto; padding: 48px 32px; }
        .auth-header { text-align: center; margin-bottom: 36px; }
        .auth-header h2 { font-size: 28px; color: #0f172a; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.5px; }
        .auth-header p { color: #64748b; font-size: 15px; }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-input { width: 100%; height: 54px; padding: 0 16px; border: 2px solid #e2e8f0; border-radius: 14px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; outline: none; transition: all 0.3s ease; font-weight: 500; }
        .auth-input:focus { border-color: #10b981; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15); }
        .auth-toggle { margin-top: 28px; text-align: center; font-size: 14px; color: #64748b; font-weight: 500; }
        .auth-toggle span { color: #10b981; cursor: pointer; font-weight: 700; transition: color 0.2s; }
        .auth-toggle span:hover { color: #059669; }

        /* CORE UI STYLES */
        .deploy-card { padding: 36px; border: 1px solid #d1fae5; }
        .deploy-label { font-size: 13px; font-weight: 800; color: #10b981; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .deploy-label .mi { font-size: 20px; }
        .input-row { display: flex; gap: 16px; align-items: center; }
        .input-wrapper { flex: 1; position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 20px; color: #94a3b8; font-size: 24px; pointer-events: none; transition: color 0.3s; }
        .gm-url-input { width: 100%; height: 56px; padding: 0 20px 0 56px; border: 2px solid #e2e8f0; border-radius: 100px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 500; color: #0f172a; background: #fff; outline: none; transition: all 0.3s ease; }
        .gm-url-input:focus { border-color: #10b981; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15); }
        .gm-url-input:focus + .input-icon { color: #10b981; }
        
        .gm-btn-primary {
          height: 56px; padding: 0 32px; background: #10b981; color: white;
          border: none; border-radius: 100px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
        }
        .gm-btn-primary:hover { background: #059669; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5); transform: translateY(-3px) scale(1.02); }
        .gm-btn-primary:active { transform: translateY(0) scale(0.98); }
        .gm-btn-primary:disabled { background: #cbd5e1; cursor: not-allowed; box-shadow: none; transform: none; }
        .gm-btn-primary.full { width: 100%; border-radius: 14px; }
        .gm-btn-primary .mi { font-size: 22px; }

        .status-chip { margin-top: 24px; display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; border-radius: 100px; font-size: 14px; font-weight: 600; animation: chipIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .status-chip.success { background: #d1fae5; color: #059669; border: 1px solid #a7f3d0; }
        .status-chip.error   { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .status-chip.loading { background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; }
        .status-chip .mi { font-size: 20px; }

        .gm-spin { width: 20px; height: 20px; border: 3px solid rgba(15, 23, 42, 0.1); border-top-color: #0f172a; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .gm-spin-white { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }

        .section-header { display: flex; align-items: center; justify-content: space-between; margin: 56px 0 24px; animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
        .section-title { font-size: 20px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 10px; letter-spacing: -0.5px; }
        .section-title .mi { font-size: 24px; color: #10b981; }
        .badge { background: #d1fae5; color: #059669; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 100px; letter-spacing: 0.5px; animation: pulse 2s infinite; }

        .gm-btn-text { background: transparent; border: 2px solid transparent; color: #10b981; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; transition: all 0.2s ease; }
        .gm-btn-text:hover { background: #ecfdf5; border-color: #d1fae5; }

        .latest-card-header { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; background: #ffffff; border-radius: 24px 24px 0 0; }
        .file-info { display: flex; align-items: center; gap: 16px; }
        .file-icon { width: 48px; height: 48px; background: #ecfdf5; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #10b981; transition: transform 0.3s ease; }
        .gm-card:hover .file-icon { transform: scale(1.1) rotate(5deg); }
        .file-icon .mi { font-size: 24px; }
        .file-name { font-size: 15px; font-weight: 700; color: #0f172a; font-family: 'Roboto Mono', monospace; }
        .file-meta { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }

        .btn-group { display: flex; gap: 12px; }
        .btn-outline { height: 42px; padding: 0 20px; border: 2px solid #10b981; color: #10b981; background: transparent; border-radius: 100px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .btn-outline:hover { background: #ecfdf5; transform: translateY(-2px); }
        .btn-solid { height: 42px; padding: 0 20px; border: none; color: #fff; background: #10b981; border-radius: 100px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); }
        .btn-solid:hover { background: #059669; box-shadow: 0 6px 15px rgba(16, 185, 129, 0.4); transform: translateY(-2px); }

        .latest-card-body { padding: 32px; font-size: 15px; line-height: 1.8; color: #334155; white-space: pre-wrap; max-height: 160px; overflow: hidden; position: relative; border-radius: 0 0 24px 24px; font-weight: 500; }
        .latest-card-body::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 100px; background: linear-gradient(transparent, white); }

        .history-grid { display: grid; gap: 16px; }
        .history-item { background: #fff; border-radius: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; overflow: hidden; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; border-left: 4px solid transparent; animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .history-item:hover { box-shadow: 0 12px 20px -5px rgba(16, 185, 129, 0.1); transform: translateY(-4px); border-left-color: #10b981; border-top-color: #d1fae5; border-right-color: #d1fae5; border-bottom-color: #d1fae5; }
        .history-item-header { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; background: #fafafa; transition: background 0.3s ease; }
        .history-item:hover .history-item-header { background: #ffffff; }
        .history-file { display: flex; align-items: center; gap: 12px; }
        .history-file-dot { width: 10px; height: 10px; border-radius: 50%; background: #10b981; flex-shrink: 0; box-shadow: 0 0 0 3px #d1fae5; }
        .history-file-name { font-size: 14px; font-weight: 700; color: #0f172a; font-family: 'Roboto Mono', monospace; }
        
        .gm-btn-dl-sm { background: transparent; border: 2px solid transparent; color: #64748b; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; transition: all 0.2s; }
        .history-item:hover .gm-btn-dl-sm { color: #10b981; background: #ecfdf5; }
        .gm-btn-dl-sm:hover { transform: translateY(-1px) scale(1.05); }
        
        .history-item-body { padding: 20px 24px; font-size: 14px; line-height: 1.7; color: #475569; white-space: pre-wrap; max-height: 110px; overflow: hidden; mask-image: linear-gradient(to bottom, black 40%, transparent 100%); font-weight: 500; }

        .empty-state { background: #fff; border-radius: 24px; padding: 56px; text-align: center; border: 2px dashed #cbd5e1; animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; transition: all 0.3s ease; }
        .empty-state:hover { border-color: #10b981; background: #f0fdf4; }
        .empty-icon { width: 72px; height: 72px; border-radius: 50%; background: #f8fafc; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #94a3b8; transition: all 0.3s ease; }
        .empty-state:hover .empty-icon { background: #d1fae5; color: #10b981; transform: scale(1.1); }
        .empty-icon .mi { font-size: 36px; }
        .empty-state p { font-size: 16px; color: #64748b; font-weight: 500; }

        /* --- MODAL STYLES --- */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 24px; animation: fadeIn 0.3s ease-out;
        }
        .modal-card {
          background: #fff; width: 100%; max-width: 760px; max-height: 85vh;
          border-radius: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          display: flex; flex-direction: column; overflow: hidden;
          animation: modalSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-header {
          padding: 28px 36px; border-bottom: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: space-between;
          background: #fafafa;
        }
        .modal-title-group { display: flex; align-items: center; gap: 16px; }
        .modal-title-icon { color: #10b981; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #ecfdf5; border-radius: 14px; }
        .modal-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
        .modal-subtitle { font-size: 14px; color: #64748b; font-family: 'Roboto Mono', monospace; margin-top: 4px; font-weight: 600; }
        .modal-close { background: #f1f5f9; border: none; color: #64748b; cursor: pointer; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
        .modal-close:hover { background: #fee2e2; color: #b91c1c; transform: rotate(90deg); }
        .modal-body {
          padding: 36px; overflow-y: auto;
          font-size: 16px; line-height: 1.8; color: #334155; white-space: pre-wrap; font-weight: 500;
        }
        .modal-body::-webkit-scrollbar { width: 8px; }
        .modal-body::-webkit-scrollbar-track { background: transparent; }
        .modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .modal-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .modal-footer { padding: 20px 36px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; background: #fff; }

        /* KEYFRAMES */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.8) rotate(-10deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes modalSlide { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes chipIn { from { opacity: 0; transform: translateY(12px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      `}</style>

      {/* --- MODAL OVERLAY --- */}
      {isModalOpen && latestSummary && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-title-icon"><span className="mi">analytics</span></div>
                <div>
                  <div className="modal-title">Executive Summary</div>
                  <div className="modal-subtitle">{latestSummary.id}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <span className="mi">close</span>
              </button>
            </div>
            <div className="modal-body">
              {latestSummary.content}
            </div>
            <div className="modal-footer">
              <button className="btn-solid" onClick={() => downloadTxt(latestSummary.content, latestSummary.id)}>
                <span className="mi">download</span> Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAV */}
      <header className="topbar">
        <div className="meet-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="40" height="40" rx="14" fill="#10B981"/>
            <path d="M28 18H12a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V20a2 2 0 00-2-2z" fill="white"/>
            <path d="M32 22l6-4v12l-6-4V22z" fill="white"/>
          </svg>
        </div>
        <span className="topbar-title">Cogni<span>Meet</span></span>
        <div className="topbar-spacer" />
        {isAuthenticated && (
          <button className="gm-btn-text" onClick={handleLogout}>
            <span className="mi">logout</span> Logout
          </button>
        )}
      </header>

      <main className="gm-main">
        <div className="gm-hero">
          <h1>CogniMeet</h1>
          <p>Deploy a bot to your Google Meet. It listens, transcribes, and delivers a structured executive summary — automatically.</p>
        </div>

        {!isAuthenticated ? (
          /* --- AUTHENTICATION SCREEN --- */
          <div className="gm-card auth-container">
            <div className="auth-header">
              <h2>{authMode === "login" ? "Welcome Back" : "Create Account"}</h2>
              <p>{authMode === "login" ? "Sign in to manage your meetings" : "Sign up to start deploying bots"}</p>
            </div>
            
            <form onSubmit={handleAuth} className="auth-form">
              <input 
                type="email" 
                placeholder="Email Address" 
                className="auth-input" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="Password" 
                className="auth-input" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {authError && <p style={{ color: "#ef4444", fontSize: "14px", fontWeight: 600 }}>{authError}</p>}
              
              <button type="submit" className="gm-btn-primary full">
                {authMode === "login" ? "Log In" : "Sign Up"}
              </button>
            </form>

            <div className="auth-toggle">
              {authMode === "login" ? (
                <p>Don't have an account? <span onClick={() => {setAuthMode("signup"); setAuthError("");}}>Sign up</span></p>
              ) : (
                <p>Already have an account? <span onClick={() => {setAuthMode("login"); setAuthError("");}}>Log in</span></p>
              )}
            </div>
          </div>
        ) : (
          /* --- DASHBOARD SCREEN --- */
          <>
            <div className="gm-card deploy-card">
              <div className="deploy-label"><span className="mi">add_circle</span> Deploy New Bot</div>
              <form onSubmit={handleDeploy} className="input-row">
                <div className="input-wrapper">
                  <span className="input-icon mi">videocam</span>
                  <input
                    type="url"
                    required
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    value={meetUrl}
                    onChange={(e) => setMeetUrl(e.target.value)}
                    className="gm-url-input"
                  />
                </div>
                <button type="submit" disabled={loading} className="gm-btn-primary">
                  {loading
                    ? <><div className="gm-spin-white" /> Deploying…</>
                    : <><span className="mi">smart_toy</span> Deploy</>
                  }
                </button>
              </form>

              {statusMsg && (
                <div className={`status-chip ${statusType}`}>
                  {statusType === "loading" && <div className="gm-spin" />}
                  {statusType === "success" && <span className="mi">check_circle</span>}
                  {statusType === "error"   && <span className="mi">error</span>}
                  {statusMsg}
                </div>
              )}
            </div>

            {!fetching && latestSummary && (
              <>
                <div className="section-header">
                  <div className="section-title">
                    <span className="mi">bolt</span>
                    Latest Meeting
                    <span className="badge">JUST IN</span>
                  </div>
                </div>
                <div className="gm-card" style={{ overflow: "hidden" }}>
                  <div className="latest-card-header">
                    <div className="file-info">
                      <div className="file-icon"><span className="mi">description</span></div>
                      <div>
                        <div className="file-name">{latestSummary.id}</div>
                        <div className="file-meta">Executive Summary</div>
                      </div>
                    </div>
                    <div className="btn-group">
                      <button className="btn-solid" onClick={() => setIsModalOpen(true)}>
                        <span className="mi">visibility</span> View
                      </button>
                      <button className="btn-outline" onClick={() => downloadTxt(latestSummary.content, latestSummary.id)}>
                        <span className="mi">download</span> Download
                      </button>
                    </div>
                  </div>
                  {/* Truncated preview area */}
                  <div className="latest-card-body">
                    {latestSummary.content}
                  </div>
                </div>
              </>
            )}

            <div className="section-header">
              <div className="section-title"><span className="mi">history</span>Summary Archives</div>
              <button className="gm-btn-text" onClick={() => loadSummaries()}>
                <span className="mi">refresh</span> Refresh
              </button>
            </div>

            {fetching ? (
              <div className="loading-row">
                <div className="gm-spin" />
                <p style={{ color: "#64748b", fontWeight: 600 }}>Fetching from AWS S3…</p>
              </div>
            ) : pastSummaries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><span className="mi">cloud_off</span></div>
                <p>No older summaries found in your cloud storage.</p>
              </div>
            ) : (
              <div className="history-grid">
                {pastSummaries.map((summary: any, index: number) => (
                  <div 
                    key={summary.id} 
                    className="history-item" 
                    onClick={() => downloadTxt(summary.content, summary.id)}
                    style={{ animationDelay: `${index * 0.1 + 0.3}s` }}
                  >
                    <div className="history-item-header">
                      <div className="history-file">
                        <div className="history-file-dot" />
                        <span className="history-file-name">{summary.id}</span>
                      </div>
                      <button className="gm-btn-dl-sm" onClick={(e) => { e.stopPropagation(); downloadTxt(summary.content, summary.id); }}>
                        <span className="mi">download</span> Download
                      </button>
                    </div>
                    <div className="history-item-body">{summary.content}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
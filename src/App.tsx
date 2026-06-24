import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "./firebase";
import AuthScreen from "./components/AuthScreen";
import HostDashboard from "./components/HostDashboard";
import ParticipantQuiz from "./components/ParticipantQuiz";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  Layers, 
  LogIn, 
  Lock, 
  HelpCircle, 
  Play, 
  Laptop, 
  Users, 
  Award, 
  CheckCircle, 
  Target, 
  ChevronRight 
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Router-like state variables
  const [roleMode, setRoleMode] = useState<"lobby" | "host" | "participant">("lobby");
  const [targetQuizId, setTargetQuizId] = useState("");

  // Synchronize Google Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Support direct share/invite links (e.g. ?code=ABCDEF)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code") || params.get("join") || params.get("pin");
      if (code) {
        setTargetQuizId(code.trim().toUpperCase());
        setRoleMode("participant");
        
        // Clear query parameters smoothly
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    } catch (e) {
      console.error("Failed to parse URL query parameters", e);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setRoleMode("lobby");
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinByCode = (code: string) => {
    setTargetQuizId(code.trim().toUpperCase());
    setRoleMode("participant");
  };

  const handleAuthSuccess = () => {
    setRoleMode("host");
  };

  // 1. Loading Phase
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070A] text-white font-sans flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background Mesh Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px] pointer-events-none" />

        <div className="text-center relative z-10 space-y-4">
          <div className="relative inline-flex mb-2">
            <span className="flex h-5 w-5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-teal-500"></span>
            </span>
          </div>
          <p className="text-xs font-mono tracking-widest text-teal-450 uppercase font-black">
            Syncing Real-Time Quizzle State...
          </p>
          <p className="text-white/40 text-[10px] font-mono">
            Establishing secure Firestore data streams
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070A] text-white font-sans flex flex-col justify-between selection:bg-teal-500 selection:text-black overflow-x-hidden relative">
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-teal-600/15 blur-[100px] pointer-events-none" />

      {/* Navigation Header */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-md relative z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => setRoleMode("lobby")} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-400 flex items-center justify-center text-black font-black text-sm tracking-tighter shadow-[0_0_15px_rgba(20,184,166,0.3)] group-hover:scale-105 transition-transform">
              Q
            </div>
            <div className="leading-none">
              <span className="text-sm font-black text-white uppercase tracking-wider block">QUZZLE</span>
              <span className="text-[9px] font-mono text-teal-400 tracking-widest font-black uppercase">Realtime Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {roleMode !== "lobby" && (
              <button 
                onClick={() => setRoleMode("lobby")}
                className="text-white/65 hover:text-white transition-colors cursor-pointer"
              >
                Exit Session
              </button>
            )}
            
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-white/55 font-mono text-[10px] hidden sm:inline-block">
                  Host: {user.email}
                </span>
                <button
                  onClick={() => setRoleMode("host")}
                  className="bg-teal-450/10 border border-teal-450/40 text-teal-300 py-1.5 px-3 rounded-lg hover:bg-teal-450/20 transition-all cursor-pointer"
                >
                  Host Console
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRoleMode("host")}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/5 py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Host Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 md:py-14 flex-1 w-full flex flex-col justify-center relative z-10">
        
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: LOBBY LANDING SELECTION CHASSIS */}
          {roleMode === "lobby" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full"
            >
              
              {/* Left Info Pitch Column */}
              <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-white/80 text-xs font-semibold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                  <span>Real-Time Cloud Platform Ready</span>
                </div>

                <h1 className="text-4xl md:text-5.5xl font-black tracking-tight text-white leading-[1.05] font-sans">
                  Interactive quizzes. <br />
                  <span className="text-white/40 font-normal italic">Analyzed in real time.</span>
                </h1>

                <p className="text-xs md:text-sm text-white/50 leading-relaxed font-sans max-w-lg mx-auto lg:mx-0">
                  Compile complex exams instantaneously simply by pasting plain-text MCQ layouts. Broadcast live synchronize countdown lobbies, monitor participant answer distributions in real-time on host graphs, and export comprehensive CSV analytics spreadsheets.
                </p>

                {/* Grid performance features */}
                <div className="pt-4 grid grid-cols-3 gap-3 max-w-md mx-auto lg:mx-0">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="block text-white font-black text-sm">MCQ</span>
                    <span className="block text-[8px] font-mono text-white/40 uppercase font-black uppercase mt-0.5">Text-Import</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="block text-teal-400 font-extrabold text-sm">Live</span>
                    <span className="block text-[8px] font-mono text-white/40 uppercase font-black uppercase mt-0.5">Telemetry</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="block text-white font-black text-sm">SQL-DB</span>
                    <span className="block text-[8px] font-mono text-white/40 uppercase font-black uppercase mt-0.5">Firestore</span>
                  </div>
                </div>
              </div>

              {/* Right Mode Chooser Panel Column */}
              <div className="lg:col-span-6 flex flex-col gap-4 font-sans max-w-md mx-auto w-full">
                
                {/* 1. Enter Contestant Lobby Block */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-teal-400/30 transition-all">
                  <div className="absolute top-[-30px] right-[-30px] w-24 h-24 rounded-full bg-teal-450/10 blur-xl pointer-events-none" />
                  
                  <div className="flex items-start gap-4 text-xs font-medium pb-4 border-b border-white/5 mb-4">
                    <div className="p-3 bg-teal-400/10 rounded-xl text-teal-400 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Join as Participant</h3>
                      <p className="text-white/45 mt-0.5 leading-normal">
                        Ready to play? Enter your exam code PIN below to join the active room session.
                      </p>
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const targetCode = (e.currentTarget.elements.namedItem("quizJoinPIN") as HTMLInputElement).value;
                      if (targetCode.trim()) handleJoinByCode(targetCode);
                    }}
                    className="flex gap-2 text-xs"
                  >
                    <input
                      name="quizJoinPIN"
                      type="text"
                      placeholder="Enter 6-digit Join PIN (e.g. QZ53B)"
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-white font-mono font-bold uppercase tracking-widest focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20 placeholder:font-sans placeholder:tracking-normal placeholder:font-normal"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-teal-400 hover:bg-teal-500 active:scale-95 text-black font-bold px-4 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </form>
                </div>

                {/* 2. Admin Host block entry */}
                <div 
                  onClick={() => setRoleMode("host")}
                  className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-5 backdrop-blur-xl shadow-md cursor-pointer transition-all flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 text-xs font-sans">
                    <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 shrink-0">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-teal-300 transition-colors">Host / Organizer Mode</p>
                      <p className="text-[11px] text-white/40">Create custom quizzes, see lives & download reports</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white transition-colors" />
                </div>

              </div>

            </motion.div>
          )}

          {/* VIEW 2: HOST ADMIN SIGN IN AND SUITE ROUTER */}
          {roleMode === "host" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {user ? (
                <HostDashboard user={user} onLogout={handleLogout} />
              ) : (
                <div className="max-w-md mx-auto">
                  <div className="text-center mb-6">
                    <span className="text-[9px] font-mono uppercase bg-white/5 text-purple-300 border border-purple-500/15 py-0.5 px-2 rounded-sm inline-block tracking-widest font-black">
                      Host Credentials Required
                    </span>
                    <h2 className="text-xl font-black text-white mt-2">Creator Login Page</h2>
                    <p className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto mt-0.5">
                      Log in to access your custom MCQs dataset, spawn real-time rooms, and download comprehensive student analytics.
                    </p>
                  </div>
                  <AuthScreen onAuthSuccess={handleAuthSuccess} />
                </div>
              )}
            </motion.div>
          )}

          {/* VIEW 3: PARTICIPANT ACTIVE LOBBY OR TEST SCREEN */}
          {roleMode === "participant" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              <ParticipantQuiz 
                quizIdParam={targetQuizId} 
                onExit={() => {
                  setTargetQuizId("");
                  setRoleMode("lobby");
                }} 
              />
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* Clean Footer */}
      <footer className="py-6 border-t border-white/5 bg-black/40 backdrop-blur-md text-center relative z-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-white/35 font-bold font-mono uppercase tracking-wider">
          <p>© {new Date().getFullYear()} Quizzle Interactive Arena. Cloud Native Sandbox.</p>
          <div className="flex items-center gap-4">
            <a 
              href="https://ai.studio/build" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-teal-400 transition-colors flex items-center gap-1"
            >
              Google AI Studio Build <ArrowRight className="w-3 h-3 text-teal-400" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

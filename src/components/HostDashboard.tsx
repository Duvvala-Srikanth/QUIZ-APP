import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { User } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  getDocs, 
  updateDoc,
  query,
  where,
  writeBatch
} from "firebase/firestore";
import { Quiz, Question, Participant, ParticipantResponse, QuizSettings } from "../types";
import { parseMCQText } from "../utils/mcqParser";
import { sanitizeFirestoreData } from "../utils/firestoreSanitizer";
import LiveLeaderboard from "./LiveLeaderboard";
import { 
  Plus, 
  Trash2, 
  Copy, 
  Play, 
  Pause, 
  Square, 
  Edit3, 
  FileSpreadsheet, 
  Settings, 
  UserCheck, 
  Award, 
  FileText, 
  PieChart, 
  Clock, 
  X, 
  HelpCircle, 
  Sparkles, 
  Upload, 
  LogOut, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  Info,
  Check,
  CheckCircle,
  XCircle,
  Flame,
  Search,
  Filter,
  Loader2,
  QrCode,
  AlertTriangle
} from "lucide-react";

interface HostDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function HostDashboard({ user, onLogout }: HostDashboardProps) {
  // Collections tracking
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Active view management
  const [activeTab, setActiveTab] = useState<"quizzes" | "create" | "monitor" | "analytics">("quizzes");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  
  // Realtime subscription states for the active monitoring quiz
  const [activeParticipants, setActiveParticipants] = useState<Participant[]>([]);
  const [activeResponses, setActiveResponses] = useState<ParticipantResponse[]>([]);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);

  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Create/Edit form states
  const [quizName, setQuizName] = useState("");
  const [quizDesc, setQuizDesc] = useState("");
  const [quizCategory, setQuizCategory] = useState("Salesforce");
  const [quizDifficulty, setQuizDifficulty] = useState("Medium");
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarkFraction, setNegativeMarkFraction] = useState(0.25);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [scoringMode, setScoringMode] = useState<"fixed" | "dynamic">("fixed");
  const [maxPoints, setMaxPoints] = useState<number>(1000);
  const [minPoints, setMinPoints] = useState<number>(0);
  const [scoringCurve, setScoringCurve] = useState<"linear" | "exponential">("linear");

  // Plain-text import MCQ field
  const [rawMCQText, setRawMCQText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Detail/Analytics specific states
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [participantReportResponses, setParticipantReportResponses] = useState<ParticipantResponse[]>([]);

  // Loading indicator for sub-processes
  const [processing, setProcessing] = useState(false);

  // Subscribe to Quizzes list on mount
  useEffect(() => {
    const qCol = query(collection(db, "quizzes"), where("hostId", "==", user.uid));
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() as Quiz }));
      
      // Sort newest first
      list.sort((a, b) => b.createdAt - a.createdAt);
      setQuizzes(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user.uid]);

  // Real-time live analytics synchronization for specific selected monitoring quiz
  useEffect(() => {
    if (selectedQuiz && (activeTab === "monitor" || activeTab === "analytics")) {
      // 1. Subscribe to Questions
      const questionsCol = collection(db, "quizzes", selectedQuiz.id, "questions");
      const unsubQ = onSnapshot(questionsCol, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() as Question }));
        list.sort((a, b) => a.order - b.order);
        setActiveQuestions(list);
      });

      // 2. Subscribe to Participants
      const participantsCol = collection(db, "quizzes", selectedQuiz.id, "participants");
      const unsubP = onSnapshot(participantsCol, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() as Participant }));
        setActiveParticipants(list);
      });

      // 3. Subscribe to Responses
      const responsesCol = collection(db, "quizzes", selectedQuiz.id, "responses");
      const unsubR = onSnapshot(responsesCol, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() as ParticipantResponse }));
        setActiveResponses(list);
      });

      return () => {
        unsubQ();
        unsubP();
        unsubR();
      };
    }
  }, [selectedQuiz, activeTab]);

  // Sync specific participant summary reports when clicking
  useEffect(() => {
    if (selectedQuiz && selectedParticipant) {
      const list = activeResponses.filter(r => r.participantId === selectedParticipant.id);
      setParticipantReportResponses(list);
    }
  }, [selectedParticipant, activeResponses, selectedQuiz]);

  // Parse pasted MCQs dynamically
  const parsePastedMCQs = () => {
    if (!rawMCQText.trim()) return;
    const mockId = "temp_quiz_id";
    const result = parseMCQText(rawMCQText, mockId);
    setParsedQuestions(result);
  };

  // Safe manual question modifier within audited list before saving
  const handleEditParsedQuestion = (id: string, updated: Partial<Question>) => {
    setParsedQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updated } as Question : q));
  };

  // Remove parsed question from list
  const handleRemoveParsedQuestion = (id: string) => {
    setParsedQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Commit Quiz + Question Subcollection to Firestore
  const handleSaveQuiz = async () => {
    if (!quizName.trim()) {
      alert("Please input a Quiz Name.");
      return;
    }
    if (parsedQuestions.length === 0) {
      alert("Please import or paste at least one question first.");
      return;
    }

    setProcessing(true);
    // Easy 6-digit alphanumeric uppercase invitation ID
    const quizId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const quizSettings: QuizSettings = {
      negativeMarking,
      negativeMarkFraction,
      randomizeQuestions,
      randomizeOptions,
      showCorrectAnswersAfterQuiz: showCorrectAnswers,
      allowReview,
      autoSubmit,
      fullScreenMode,
      maxParticipants,
      scoringMode,
      maxPoints,
      minPoints,
      scoringCurve
    };

    const newQuiz: Quiz = {
      id: quizId,
      hostId: user.uid,
      name: quizName.trim(),
      description: quizDesc.trim(),
      category: quizCategory,
      difficulty: quizDifficulty,
      createdAt: Date.now(),
      status: "Draft",
      paused: false,
      activeQuestionIndex: 0,
      currentQuestionStartTime: Date.now(),
      settings: quizSettings
    };

    try {
      // Create a batch write
      const batch = writeBatch(db);

      // 1. Queue Quiz document creation
      const quizDocRef = doc(db, "quizzes", quizId);
      batch.set(quizDocRef, sanitizeFirestoreData(newQuiz));

      // 2. Queue questions in subcollection
      for (const question of parsedQuestions) {
        const questionId = question.id;
        const qDocRef = doc(db, "quizzes", quizId, "questions", questionId);
        // Correct quizId on saved questions and sanitize them deep
        const sanitizedQuestion = sanitizeFirestoreData({ ...question, quizId });
        batch.set(qDocRef, sanitizedQuestion);
      }

      // 3. Commit atomic batch operation
      await batch.commit();

      // Reset form variables
      setQuizName("");
      setQuizDesc("");
      setRawMCQText("");
      setParsedQuestions([]);
      setScoringMode("fixed");
      setMaxPoints(1000);
      setMinPoints(0);
      setScoringCurve("linear");
      setActiveTab("quizzes");
      alert(`Quiz successfully compiled! Invitation Code: ${quizId}`);
    } catch (err: any) {
      alert(`Error compiling quiz: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Dual Actions
  const handleDuplicateQuiz = async (qz: Quiz) => {
    setProcessing(true);
    const newQuizId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      // Get all existing questions of source
      const qCol = collection(db, "quizzes", qz.id, "questions");
      const qSnap = await getDocs(qCol);
      
      const newQuiz: Quiz = {
        ...qz,
        id: newQuizId,
        name: `${qz.name} (Copy)`,
        createdAt: Date.now(),
        status: "Draft",
        paused: false
      };

      const batch = writeBatch(db);

      // 1. Queuing quiz doc creation
      const quizDocRef = doc(db, "quizzes", newQuizId);
      batch.set(quizDocRef, sanitizeFirestoreData(newQuiz));

      // 2. Queuing all subcollection question creations
      for (const d of qSnap.docs) {
        const qData = d.data() as Question;
        const qDocRef = doc(db, "quizzes", newQuizId, "questions", d.id);
        const sanitizedQuestion = sanitizeFirestoreData({
          ...qData,
          quizId: newQuizId
        });
        batch.set(qDocRef, sanitizedQuestion);
      }

      // 3. Commit atomically
      await batch.commit();

      alert(`Quiz duplicated! New joining Code: ${newQuizId}`);
    } catch (err: any) {
      alert(`Failed duplicating: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this quiz? All participants and telemetry reports will be deleted.")) return;
    setProcessing(true);
    try {
      await deleteDoc(doc(db, "quizzes", id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Live Commands
  const setLive = async (quizId: string) => {
    try {
      await updateDoc(doc(db, "quizzes", quizId), { status: "Live", paused: false });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const setPaused = async (quizId: string, pauseVal: boolean) => {
    try {
      await updateDoc(doc(db, "quizzes", quizId), { paused: pauseVal });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const endQuizSession = async (quizId: string) => {
    try {
      await updateDoc(doc(db, "quizzes", quizId), { status: "Completed" });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export telemetries as clean standard raw CSV downloaders
  const exportTelemetryCSV = () => {
    if (!selectedQuiz || activeParticipants.length === 0) {
      alert("No telemetry records found to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // File 1: Leaderboard results
    csvContent += "=== LEADERBOARD RESULTS ===\n";
    csvContent += "Rank,Name,Email,Roll Number,Score,Accuracy (%),Duration (s),Status,Completion Time\n";

    // Sort rankings first
    const ranked = [...activeParticipants].sort((a, b) => {
      const d = (b.finalScore || 0) - (a.finalScore || 0);
      if (d !== 0) return d;
      return (a.totalTime || 0) - (b.totalTime || 0);
    });

    ranked.forEach((p, idx) => {
      csvContent += `${idx + 1},"${p.name}","${p.email || ""}","${p.rollNumber || ""}",${p.finalScore || 0},${Math.round(p.accuracy || 0)},${p.totalTime || 0},"${p.status}","${p.endTime ? new Date(p.endTime).toLocaleString() : ""}"\n`;
    });

    csvContent += "\n=== QUESTIONS SUMMARY ===\n";
    csvContent += "Order,Question Title,Correct Option,Weight (Marks),Correct Responses Count,Wrong Responses Count\n";

    activeQuestions.forEach(q => {
      const qResponses = activeResponses.filter(r => r.questionId === q.id);
      const corrects = qResponses.filter(r => r.selectedOption === q.answer).length;
      const wrongs = qResponses.filter(r => r.selectedOption !== null && r.selectedOption !== q.answer).length;
      csvContent += `${q.order},"${q.text.replace(/"/g, '""')}",${q.answer},${q.marks},${corrects},${wrongs}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `${selectedQuiz.name.replace(/\s+/g, "_")}_Reports.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Compute aggregate counters for active monitor/analytics
  const getAggregates = () => {
    const completed = activeParticipants.filter(p => p.status === "Completed");
    const running = activeParticipants.filter(p => p.status === "In Progress");
    const size = activeParticipants.length;

    if (size === 0) {
      return { size: 0, completed: 0, running: 0, avgScore: 0, hi: 0, lo: 0, passPct: 0 };
    }

    const scores = activeParticipants.map(p => p.finalScore ?? 0);
    const avgScore = scores.reduce((sum, val) => sum + val, 0) / size;
    const hi = Math.max(...scores, 0);
    const lo = Math.min(...scores, 0);

    // Pass threshold is 50%
    const passers = activeParticipants.filter(p => (p.percentage ?? 0) >= 50);
    const passPct = (passers.length / size) * 100;

    return {
      size,
      completed: completed.length,
      running: running.length,
      avgScore: Math.round(avgScore * 100) / 100,
      hi: Math.round(hi * 100) / 100,
      lo: Math.round(lo * 100) / 100,
      passPct: Math.round(passPct)
    };
  };

  const stats = getAggregates();

  // Categories list
  const categories = ["Salesforce", "Engineering", "General Trivia", "Coding Quiz", "Aptitude"];

  // Filtered quizzes
  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = q.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All" || q.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* Dynamic Navigation Top bar */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-teal-400/10 rounded-xl text-teal-400">
            <PieChart className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-teal-400 uppercase font-black">
              QUIZZLE SYSTEM HOST
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">
              Creator Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 font-semibold">
          <button
            onClick={() => {
              setActiveTab("quizzes");
              setSelectedQuiz(null);
            }}
            className={`py-2 px-3 text-xs rounded-xl transition-all cursor-pointer ${
              activeTab === "quizzes" ? "bg-teal-400 text-black" : "bg-white/5 hover:bg-white/10 text-white"
            }`}
          >
            Quizzes List
          </button>
          
          <button
            onClick={() => setActiveTab("create")}
            className={`py-2 px-3 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "create" ? "bg-teal-400 text-black" : "bg-teal-400/10 border border-teal-400/35 hover:bg-teal-400/20 text-teal-300"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Quiz</span>
          </button>

          <button
            onClick={onLogout}
            className="p-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-white/55 rounded-xl transition-all cursor-pointer border border-white/5 hover:border-red-500/20"
            title="Log out admin profile"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Primary tab views router router */}

      {/* TAB A: LIST ALL REGISTERED QUIZZES */}
      {activeTab === "quizzes" && (
        <div className="space-y-6">
          {/* Filtering panels */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by quiz name or 6-digit Join PIN..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20"
              />
            </div>
            
            <div className="md:col-span-4 relative">
              <Filter className="absolute left-3.5 top-3 w-4 h-4 text-white/30" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:border-teal-400/50 outline-none transition-all cursor-pointer"
              >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              onClick={() => setActiveTab("create")}
              className="md:col-span-2 bg-teal-400 hover:bg-teal-500 text-black rounded-xl text-xs font-bold transition-all py-2.5 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>New</span>
            </button>
          </div>

          {/* Cards map */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <span className="text-xs font-mono">Synchronizing Creator Quizzes...</span>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center space-y-4 max-w-md mx-auto">
              <div className="inline-flex p-4 bg-white/5 rounded-full text-white/30">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white">No Quizzes compiled yet</p>
              <p className="text-xs text-white/45 max-w-xs mx-auto">
                Paste any textual MCQ collection containing Option lists, Answer keys, and Mark weights to automatically build your first game.
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="bg-teal-400 hover:bg-teal-500 text-black py-2 px-4 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Assemble First Quiz Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredQuizzes.map((qz) => {
                let badgeStyle = "bg-white/5 text-white/60";
                if (qz.status === "Live") badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                if (qz.status === "Completed") badgeStyle = "bg-blue-500/10 text-blue-400 border border-blue-500/20";

                return (
                  <div
                    key={qz.id}
                    className="bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] rounded-2xl p-5 backdrop-blur-xl transition-all shadow-md relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Card layout row 1 */}
                       <div className="flex items-start justify-between gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded bg-white/5 text-[9px] font-mono font-black uppercase tracking-wider ${badgeStyle}`}>
                          {qz.status}
                        </span>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              const shareLink = `${window.location.origin}/?code=${qz.id}`;
                              navigator.clipboard.writeText(shareLink);
                              alert(`Direct Invite Link Copied to Clipboard!\nShare with participants:\n${shareLink}`);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="flex items-center gap-1 font-mono text-[10px] text-teal-300 hover:text-white font-bold bg-teal-400/10 hover:bg-teal-400/25 px-2.5 py-0.5 rounded border border-teal-500/15 transition-all cursor-pointer"
                          title="Copy direct invitation link"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
                          <span>PIN: {qz.id}</span>
                          <Copy className="w-2.5 h-2.5 ml-1 text-teal-300/50" />
                        </button>
                      </div>

                      {/* Name/Desc */}
                      <h3 className="text-base font-extrabold text-white leading-tight capitalize truncate">
                        {qz.name}
                      </h3>
                      <p className="text-xs text-white/50 leading-relaxed line-clamp-2 mt-1 mb-4">
                        {qz.description || "No description configured."}
                      </p>

                      {/* Quick Meta grids */}
                      <div className="grid grid-cols-3 gap-2.5 mb-5 text-[10px] text-white/50 font-mono">
                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                          <span className="block text-white/30 text-[8px] uppercase font-bold text-center">Category</span>
                          <span className="block truncate font-black text-white text-center mt-0.5">{qz.category}</span>
                        </div>
                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                          <span className="block text-white/30 text-[8px] uppercase font-bold text-center">Questions</span>
                          <span className="block font-black text-white text-center mt-0.5">{qz.settings?.randomizeQuestions ? "Rand" : "Fixed"}</span>
                        </div>
                        <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                          <span className="block text-white/30 text-[8px] uppercase font-bold text-center">Difficulty</span>
                          <span className="block font-black text-white text-center mt-0.5">{qz.difficulty}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions row */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <span className="text-[10px] font-mono text-white/30">
                        {new Date(qz.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {qz.status === "Draft" ? (
                          <button
                            onClick={() => setLive(qz.id)}
                            className="bg-emerald-400 hover:bg-emerald-500 text-black py-1.5 px-2.5 rounded-lg flex items-center gap-0.5 transition-all cursor-pointer"
                            title="Publish Live quiz room"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Publish</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedQuiz(qz);
                              setActiveTab(qz.status === "Live" ? "monitor" : "analytics");
                            }}
                            className="bg-teal-400 hover:bg-teal-500 text-black py-1.5 px-2.5 rounded-lg flex items-center gap-0.5 transition-all cursor-pointer"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>{qz.status === "Live" ? "Monitor" : "View Results"}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDuplicateQuiz(qz)}
                          className="p-1.5 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white rounded-lg border border-white/5 transition-all cursor-pointer"
                          title="Duplicate copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteQuiz(qz.id)}
                          className="p-1.5 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-lg border border-white/5 hover:border-red-500/20 transition-all cursor-pointer"
                          title="Remove completely"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* TAB B: ASSEMBLER / CREATE QUIZ WITH ADVANCED IMPORTING */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel form config input */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-lg space-y-4">
            <h3 className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase">
              1. Quiz Metadata Settings
            </h3>
            
            <div className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="text-white/60 font-semibold mb-1 block">Quiz Title</label>
                <input
                  type="text"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder="Salesforce Developer Certification Prep"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-white/60 font-semibold mb- block">Description</label>
                <textarea
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                  placeholder="Master core developer principles, APEX execution flows, and CRM deployments."
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 font-semibold mb-1 block">Category</label>
                  <select
                    value={quizCategory}
                    onChange={(e) => setQuizCategory(e.target.value)}
                    className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-2.5 px-3 text-white focus:border-teal-400/50 outline-none transition-all cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="text-white/60 font-semibold mb-1 block">Difficulty</label>
                  <select
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value)}
                    className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-2.5 px-3 text-white focus:border-teal-400/50 outline-none transition-all cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Advanced Flags collapsible/list */}
              <div className="border-t border-white/5 pt-3.5 space-y-3">
                <h4 className="text-[10px] font-mono text-white/40 uppercase font-black tracking-wide">
                  Advanced Proctors
                </h4>

                {/* Toggle negative markings */}
                <div className="flex items-center justify-between py-1 bg-black/10 px-3 rounded-lg border border-white/5">
                  <div className="leading-tight pr-2">
                    <span className="text-white/80 font-bold block">Negative Marking</span>
                    <span className="text-[9px] text-white/40">Deduct incorrect choice score</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                    className="accent-teal-400 w-4 h-4"
                  />
                </div>

                {negativeMarking && (
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5 animate-fadeIn">
                    <label className="text-white/60 font-semibold mb-1 block">Wrong Factor Fraction</label>
                    <select
                      value={negativeMarkFraction}
                      onChange={(e) => setNegativeMarkFraction(parseFloat(e.target.value))}
                      className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-2 px-3 text-white focus:border-teal-400/50 outline-none transition-all"
                    >
                      <option value="0.25">0.25 (Quarter Marks deducted)</option>
                      <option value="0.33">0.33 (1/3 Marks deducted)</option>
                      <option value="0.50">0.50 (Half Marks deducted)</option>
                      <option value="1.00">1.00 (Full Question Marks deducted)</option>
                    </select>
                  </div>
                )}

                {/* Max Attendees */}
                <div className="flex items-center justify-between py-1 bg-black/10 px-3 rounded-lg border border-white/5">
                  <div className="leading-tight pr-2">
                    <span className="text-white/80 font-bold block">Max Participants</span>
                    <span className="text-[9px] text-white/40">Cap total joining attendees limit</span>
                  </div>
                  <input
                    type="number"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10) || 50)}
                    className="bg-black/40 border border-white/10 rounded py-1 px-2 text-white font-mono w-16 text-center focus:border-teal-400/50 outline-none"
                  />
                </div>

                {/* Randomized options */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2 bg-black/10 rounded-lg border border-white/5">
                    <span className="text-white/80 font-bold">Random Qs</span>
                    <input
                      type="checkbox"
                      checked={randomizeQuestions}
                      onChange={(e) => setRandomizeQuestions(e.target.checked)}
                      className="accent-teal-400 w-3.5 h-3.5"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-black/10 rounded-lg border border-white/5">
                    <span className="text-white/80 font-bold">Random Options</span>
                    <input
                      type="checkbox"
                      checked={randomizeOptions}
                      onChange={(e) => setRandomizeOptions(e.target.checked)}
                      className="accent-teal-400 w-3.5 h-3.5"
                    />
                  </div>
                </div>

                {/* Competitive Scoring Mode Section */}
                <div className="border-t border-white/5 pt-3.5 space-y-3">
                  <h4 className="text-[10px] font-mono text-teal-400 uppercase font-black tracking-wide">
                    Competitive Scoring Engine
                  </h4>

                  <div className="bg-black/10 p-3 rounded-lg border border-white/5 space-y-2.5">
                    <label className="text-white/80 font-bold block text-xs">Scoring Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setScoringMode("fixed")}
                        className={`py-1.5 px-3 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                          scoringMode === "fixed"
                            ? "bg-teal-400 text-black border-teal-400"
                            : "bg-[#0a1120] text-white/60 border-white/10 hover:border-white/20"
                        }`}
                      >
                        Fixed Marks
                      </button>
                      <button
                        type="button"
                        onClick={() => setScoringMode("dynamic")}
                        className={`py-1.5 px-3 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                          scoringMode === "dynamic"
                            ? "bg-teal-400 text-black border-teal-400"
                            : "bg-[#0a1120] text-white/60 border-white/10 hover:border-white/20"
                        }`}
                      >
                        ⚡ Time-Based
                      </button>
                    </div>
                  </div>

                  {scoringMode === "dynamic" && (
                    <div className="bg-black/20 p-3 rounded-xl border border-teal-400/20 space-y-3 animate-fadeIn font-sans">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/60 font-semibold">Max Points per Q</span>
                          <span className="text-teal-400 font-mono font-bold">{maxPoints} pts</span>
                        </div>
                        <input
                          type="number"
                          value={maxPoints}
                          onChange={(e) => setMaxPoints(parseInt(e.target.value, 10) || 1000)}
                          className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:border-teal-400/50 outline-none"
                          placeholder="e.g. 1000"
                        />
                        <span className="text-[9px] text-white/30 block mt-0.5">Awarded at 0s response time</span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/60 font-semibold">Min Points per Q</span>
                          <span className="text-teal-400 font-mono font-bold">{minPoints} pts</span>
                        </div>
                        <input
                          type="number"
                          value={minPoints}
                          onChange={(e) => setMinPoints(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:border-teal-400/50 outline-none"
                          placeholder="e.g. 0"
                        />
                        <span className="text-[9px] text-white/30 block mt-0.5">Awarded when the time expires</span>
                      </div>

                      <div>
                        <label className="text-white/60 font-semibold mb-1 block text-[11px]">Decay Curve</label>
                        <select
                          value={scoringCurve}
                          onChange={(e) => setScoringCurve(e.target.value as "linear" | "exponential")}
                          className="w-full bg-[#0a1120] border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:border-teal-400/50 outline-none cursor-pointer"
                        >
                          <option value="linear">Linear Decay (Proportional)</option>
                          <option value="exponential">Exponential Decay (Favour Speed)</option>
                        </select>
                        <span className="text-[9px] text-white/30 block mt-0.5">
                          {scoringCurve === "linear"
                            ? "Points decline evenly down to minimum over the question duration."
                            : "Points decline rapidly at first, rewarding extremely fast correct answers."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* Right panel text area import parsed review */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
              <h3 className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                <span>2. Plain-Text MCQ Smart Import</span>
              </h3>
              
              <button
                onClick={() => setRawMCQText(`Question 1:
What is the primary Apex character count statement?

A. String.length()
B. size()
C. count()
D. length()`)}
                className="text-[9px] font-mono text-teal-300 font-bold underline bg-transparent border-none cursor-pointer self-start"
              >
                Insert sample text formatting
              </button>
            </div>

            <p className="text-[11px] text-white/50 leading-relaxed font-sans mt-1">
              Input raw formatted texts directly. Copy-paste lists of nested MCQs; the engine parses <strong>Questions, A, B, C, D indices, Answers, individual time limits, and marks</strong> dynamically.
            </p>

            <div className="space-y-3.5">
              <textarea
                value={rawMCQText}
                onChange={(e) => setRawMCQText(e.target.value)}
                placeholder="Question 1:&#13;Which keyword represents static variables in Apex?&#13;&#13;A. static&#13;B. final&#13;C. constant&#13;D. transient&#13;&#13;Answer: A&#13;Marks: 5&#13;Time: 30"
                rows={7}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs focus:border-teal-400/50 outline-none transition-all placeholder:text-white/10 resize-y"
              />

              <button
                type="button"
                onClick={parsePastedMCQs}
                disabled={!rawMCQText.trim()}
                className="bg-teal-400 hover:bg-teal-500 disabled:opacity-30 disabled:pointer-events-none text-black py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer w-full"
              >
                <span>Process & Parse Plain text</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Audits & Edits section */}
            {parsedQuestions.length > 0 && (
              <div className="border-t border-white/10 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-mono text-white/40 uppercase font-black tracking-widest">
                    Parsed Questions Audit ({parsedQuestions.length})
                  </h4>
                  <span className="text-[9px] text-teal-400 font-bold bg-teal-400/10 px-2 py-0.5 rounded-sm font-mono">
                    Editable list
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {parsedQuestions.map((q, idx) => {
                    const isEditing = editingQuestionId === q.id;

                    return (
                      <div
                        key={q.id}
                        className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3.5 text-xs font-sans relative"
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-mono bg-white/5 py-0.5 px-2 rounded-sm text-[10px] text-white/50">
                            Q{idx + 1}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingQuestionId(isEditing ? null : q.id)}
                              className="p-1 text-white/50 hover:text-teal-400 transition-colors"
                              title={isEditing ? "Save question layout" : "Edit item details"}
                            >
                              {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleRemoveParsedQuestion(q.id)}
                              className="p-1 text-white/50 hover:text-red-400 transition-colors"
                              title="Delete parsed question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {q.validationErrors && q.validationErrors.length > 0 && (
                          <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg p-2.5 space-y-1 text-[11px] font-sans">
                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-red-450">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
                              <span>Parsing Validation Warnings ({q.validationErrors.length})</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-red-300">
                              {q.validationErrors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2.5 font-sans">
                            <input
                              type="text"
                              value={q.text}
                              onChange={(e) => handleEditParsedQuestion(q.id, { text: e.target.value })}
                              className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1 text-white font-bold"
                            />
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] text-white/40 leading-none">A</span>
                                <input
                                  type="text"
                                  value={q.options.A}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { options: { ...q.options, A: e.target.value } })}
                                  className="w-full bg-black/40 border border-white/5 rounded py-0.5 px-2"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 leading-none">B</span>
                                <input
                                  type="text"
                                  value={q.options.B}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { options: { ...q.options, B: e.target.value } })}
                                  className="w-full bg-black/40 border border-white/5 rounded py-0.5 px-2"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 leading-none">C</span>
                                <input
                                  type="text"
                                  value={q.options.C}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { options: { ...q.options, C: e.target.value } })}
                                  className="w-full bg-black/40 border border-white/5 rounded py-0.5 px-2"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 leading-none">D</span>
                                <input
                                  type="text"
                                  value={q.options.D}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { options: { ...q.options, D: e.target.value } })}
                                  className="w-full bg-black/40 border border-white/5 rounded py-0.5 px-2"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <span className="text-[10px] text-white/40 block leading-none">Ans</span>
                                <select
                                  value={q.answer}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { answer: e.target.value as any })}
                                  className="bg-black/40 border border-white/5 rounded py-0.5 px-2 text-white w-full"
                                >
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                </select>
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 block leading-none">Marks</span>
                                <input
                                  type="number"
                                  value={q.marks}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { marks: parseInt(e.target.value, 10) || 5 })}
                                  className="bg-black/40 border border-white/5 rounded py-0.5 px-2 text-white w-full font-mono"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-white/40 block leading-none">Time (s)</span>
                                <input
                                  type="number"
                                  value={q.timeLimit}
                                  onChange={(e) => handleEditParsedQuestion(q.id, { timeLimit: parseInt(e.target.value, 10) || 30 })}
                                  className="bg-black/40 border border-white/5 rounded py-0.5 px-2 text-white w-full font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 font-sans leading-relaxed">
                            <p className="font-bold text-white text-xs">{q.text}</p>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-white/60">
                              <span>A. {q.options.A}</span>
                              <span>B. {q.options.B}</span>
                              <span>C. {q.options.C}</span>
                              <span>D. {q.options.D}</span>
                            </div>
                            <div className="flex items-center gap-6 text-[10px] font-mono text-white/45 pt-1 border-t border-white/5">
                              <span>Key: <strong className="text-teal-400 font-bold">{q.answer}</strong></span>
                              <span>Marks: <strong className="text-white">{q.marks}</strong></span>
                              <span>Timer: <strong className="text-white">{q.timeLimit}s</strong></span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleSaveQuiz}
                  disabled={processing}
                  className="w-full bg-emerald-400 hover:bg-emerald-500 disabled:opacity-40 text-black font-black text-xs py-3 rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Compile & Build Quiz Platform</span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}


      {/* TAB C: REAL-TIME LOBBY MONITOR (Lobby Telemetry when Live) */}
      {activeTab === "monitor" && selectedQuiz && (
        <div className="space-y-6">
          {/* Header monitor stats controller */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-5">
            <div>
              <span className="px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 text-[9px] font-mono font-bold uppercase tracking-wider">
                ● Live active broadcast room
              </span>
              <h2 className="text-xl font-black text-white mt-1 capitalize leading-none">{selectedQuiz.name}</h2>
              <span className="text-[10px] font-mono text-white/40 block mt-1.5">Join PIN: <strong>{selectedQuiz.id}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 font-bold text-xs">
              {selectedQuiz.paused ? (
                <button
                  onClick={() => setPaused(selectedQuiz.id, false)}
                  className="bg-emerald-400 hover:bg-emerald-500 text-black py-2 px-3 rounded-xl flex items-center gap-0.5 cursor-pointer outline-none transition-all"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Resume Quiz</span>
                </button>
              ) : (
                <button
                  onClick={() => setPaused(selectedQuiz.id, true)}
                  className="bg-amber-400 hover:bg-amber-500 text-black py-2 px-3 rounded-xl flex items-center gap-0.5 cursor-pointer outline-none transition-all"
                >
                  <Pause className="w-4 h-4 shrink-0" />
                  <span>Pause Quiz</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (window.confirm("Complete this live quiz active session? All participant inputs will be finalized.")) {
                    endQuizSession(selectedQuiz.id);
                    setActiveTab("analytics");
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-xl flex items-center gap-0.5 cursor-pointer outline-none transition-all"
              >
                <Square className="w-4 h-4 shrink-0 fill-white" />
                <span>End Test Session</span>
              </button>
            </div>
          </div>

          {/* Dynamic Invite Link & QR Code Billboard Card */}
          <div className="bg-gradient-to-r from-teal-950/40 via-black/50 to-blue-950/40 border border-teal-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Visual background accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="col-span-1 md:col-span-8 space-y-4 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] font-mono tracking-wider font-bold">
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span>PARTICIPANTS JOIN BILLBOARD</span>
              </div>
              
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
                Ready to Join? Scan the QR or Use the Direct Link!
              </h3>
              
              <p className="text-white/60 text-xs max-w-xl">
                Display this screen or scan screen to let your participants join the session instantly with their mobile camera, or copy the direct join URL below.
              </p>

              {/* Direct Link copy box */}
              <div className="space-y-1.5 max-w-lg">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block">Direct Invite Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs text-teal-300 font-mono flex items-center overflow-x-auto whitespace-nowrap select-all">
                    {window.location.origin}/?code={selectedQuiz.id}
                  </div>
                  <button
                    onClick={() => {
                      try {
                        const link = `${window.location.origin}/?code=${selectedQuiz.id}`;
                        navigator.clipboard.writeText(link);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="bg-teal-400 hover:bg-teal-500 active:scale-95 text-black font-extrabold px-4 rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-all text-xs cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* QR Code Segment */}
            <div className="col-span-1 md:col-span-4 flex flex-col items-center justify-center relative z-10 text-center space-y-2">
              <div className="p-3 bg-white rounded-xl shadow-lg relative group transition-transform duration-300 hover:scale-[1.03] inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=05070a&bgcolor=ffffff&data=${encodeURIComponent(
                    `${window.location.origin}/?code=${selectedQuiz.id}`
                  )}`}
                  alt="Join QR Code"
                  className="w-36 h-36 object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-teal-450 tracking-wider">
                JOIN PIN: <span className="text-white text-base font-black px-2 py-0.5 rounded bg-white/5 border border-white/10 ml-1 select-all">{selectedQuiz.id}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Live attendee participants lists */}
            <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-400" />
                  <span>Participants Lobby ({activeParticipants.length})</span>
                </h4>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto pr-1 text-xs font-sans">
                {activeParticipants.length === 0 ? (
                  <div className="py-12 border border-dashed border-white/5 text-center text-white/30 rounded-xl">
                    Waiting for players to join using PIN...
                  </div>
                ) : (
                  activeParticipants.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="block font-bold text-white truncate max-w-[150px]">{p.name}</span>
                        {p.rollNumber && <span className="text-[10px] text-white/40 font-mono">Roll: {p.rollNumber}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        {p.status === "Completed" ? (
                          <span className="font-semibold text-emerald-400 text-[10px] bg-emerald-400/10 px-1.5 py-0.5 rounded font-mono">
                            Submitted
                          </span>
                        ) : (
                          <span className="font-semibold text-yellow-400 text-[10px] bg-yellow-400/10 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                            Active
                          </span>
                        )}
                        <span className="font-black font-mono text-white">{p.finalScore || 0} pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live aggregated Option Choice stats! */}
            <div className="lg:col-span-8 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl space-y-5">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                <span>Real-Time Contestant Input Graph (Tally counts)</span>
              </h4>

              <div className="space-y-6">
                {activeQuestions.length === 0 ? (
                  <div className="py-16 text-center text-xs text-white/30 font-mono">
                    Populating questions telemetry stats...
                  </div>
                ) : (
                  activeQuestions.slice(selectedQuiz.activeQuestionIndex, selectedQuiz.activeQuestionIndex + 1).map((q) => {
                    const qResponses = activeResponses.filter(r => r.questionId === q.id);
                    const totalAnswers = qResponses.length;

                    // Option tally totals
                    const aCount = qResponses.filter(r => r.selectedOption === "A").length;
                    const bCount = qResponses.filter(r => r.selectedOption === "B").length;
                    const cCount = qResponses.filter(r => r.selectedOption === "C").length;
                    const dCount = qResponses.filter(r => r.selectedOption === "D").length;

                    const getPct = (cnt: number) => {
                      if (totalAnswers === 0) return 0;
                      return Math.round((cnt / totalAnswers) * 100);
                    };

                    return (
                      <div key={q.id} className="space-y-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <span className="text-[10px] text-white/40 font-mono uppercase font-black block mb-1">
                            Current Question Block (Order: {q.order})
                          </span>
                          <h3 className="text-sm font-black text-white">{q.text}</h3>
                        </div>

                        {/* Interactive dynamic SVGs for choice distributions! */}
                        <div className="space-y-3 font-sans text-xs">
                          {/* Option A Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-white/70">
                              <span>A. {q.options.A} {q.answer === "A" && "✅"}</span>
                              <span className="font-mono font-bold text-white">{aCount} response ({getPct(aCount)}%)</span>
                            </div>
                            <div className="h-2 rounded bg-white/5 overflow-hidden border border-white/5 relative">
                              <div className="absolute inset-y-0 left-0 bg-red-400 transition-all duration-300" style={{ width: `${getPct(aCount)}%` }} />
                            </div>
                          </div>

                          {/* Option B Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-white/77">
                              <span>B. {q.options.B} {q.answer === "B" && "✅"}</span>
                              <span className="font-mono font-bold text-white">{bCount} response ({getPct(bCount)}%)</span>
                            </div>
                            <div className="h-2 rounded bg-white/5 overflow-hidden border border-white/5 relative">
                              <div className="absolute inset-y-0 left-0 bg-blue-400 transition-all duration-300" style={{ width: `${getPct(bCount)}%` }} />
                            </div>
                          </div>

                          {/* Option C Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-white/77">
                              <span>C. {q.options.C} {q.answer === "C" && "✅"}</span>
                              <span className="font-mono font-bold text-white">{cCount} response ({getPct(cCount)}%)</span>
                            </div>
                            <div className="h-2 rounded bg-white/5 overflow-hidden border border-white/5 relative">
                              <div className="absolute inset-y-0 left-0 bg-yellow-400 transition-all duration-300" style={{ width: `${getPct(cCount)}%` }} />
                            </div>
                          </div>

                          {/* Option D Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] text-white/77">
                              <span>D. {q.options.D} {q.answer === "D" && "✅"}</span>
                              <span className="font-mono font-bold text-white">{dCount} response ({getPct(dCount)}%)</span>
                            </div>
                            <div className="h-2 rounded bg-white/5 overflow-hidden border border-white/5 relative">
                              <div className="absolute inset-y-0 left-0 bg-teal-400 transition-all duration-300" style={{ width: `${getPct(dCount)}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Interactive deck switches */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-4">
                          <button
                            onClick={() => {
                              const prevIdx = Math.max(0, selectedQuiz.activeQuestionIndex - 1);
                              updateDoc(doc(db, "quizzes", selectedQuiz.id), { activeQuestionIndex: prevIdx });
                              setSelectedQuiz({ ...selectedQuiz, activeQuestionIndex: prevIdx });
                            }}
                            disabled={selectedQuiz.activeQuestionIndex === 0}
                            className="bg-white/5 border border-white/5 text-white/70 hover:bg-white/10 text-xs py-1.5 px-3 rounded-lg cursor-pointer disabled:opacity-20 disabled:pointer-events-none transition-all"
                          >
                            Prev Question
                          </button>
                          
                          <span className="text-[10px] font-mono text-white/45">
                            Focus: slide {selectedQuiz.activeQuestionIndex + 1} of {activeQuestions.length}
                          </span>

                          <button
                            onClick={() => {
                              const nextIdx = Math.min(activeQuestions.length - 1, selectedQuiz.activeQuestionIndex + 1);
                              updateDoc(doc(db, "quizzes", selectedQuiz.id), { activeQuestionIndex: nextIdx });
                              setSelectedQuiz({ ...selectedQuiz, activeQuestionIndex: nextIdx });
                            }}
                            disabled={selectedQuiz.activeQuestionIndex === activeQuestions.length - 1}
                            className="bg-white/5 border border-white/5 text-white/70 hover:bg-white/10 text-xs py-1.5 px-3 rounded-lg cursor-pointer disabled:opacity-20 disabled:pointer-events-none transition-all"
                          >
                            Next Question
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      )}


      {/* TAB D: ANALYTICS, LEADERBOARDS, EXPANSIVE PDF/EXCEL/CSV EXPORT CHASSIS */}
      {activeTab === "analytics" && selectedQuiz && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Header row stats reports */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-5">
            <div>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-mono font-bold uppercase tracking-wider border border-blue-500/10">
                Completed Test Analysis Reports
              </span>
              <h2 className="text-xl font-black text-white mt-1 capitalize leading-none">{selectedQuiz.name}</h2>
              <span className="text-[10px] font-mono text-white/40 block mt-1.5">Invitation code: <strong>{selectedQuiz.id}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold font-sans">
              <button
                onClick={exportTelemetryCSV}
                className="bg-teal-400 hover:bg-teal-500 text-black py-2.5 px-4 rounded-xl flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Export CSV Reports</span>
              </button>
              
              <button
                onClick={() => {
                  setSelectedQuiz(null);
                  setActiveTab("quizzes");
                }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all text-xs font-semibold"
              >
                Exit Summary
              </button>
            </div>
          </div>

          {/* Quick aggregates card grid row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center backdrop-blur-md">
              <span className="text-[9px] font-mono text-white/40 block uppercase">Total Players</span>
              <span className="text-xl font-bold font-mono text-white block mt-1">{stats.size}</span>
            </div>
            
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center backdrop-blur-md">
              <span className="text-[9px] font-mono text-white/40 block uppercase">Avg Score</span>
              <span className="text-xl font-bold font-mono text-teal-400 block mt-1">{stats.avgScore}</span>
            </div>

            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center backdrop-blur-md">
              <span className="text-[9px] font-mono text-white/40 block uppercase">High Score</span>
              <span className="text-xl font-bold font-mono text-white block mt-1">{stats.hi}</span>
            </div>

            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center backdrop-blur-md">
              <span className="text-[9px] font-mono text-white/40 block uppercase">Low Score</span>
              <span className="text-xl font-bold font-mono text-white block mt-1">{stats.lo}</span>
            </div>

            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center backdrop-blur-md">
              <span className="text-[9px] font-mono text-white/40 block uppercase">Pass Percentage</span>
              <span className="text-xl font-bold font-mono text-emerald-400 block mt-1">{stats.passPct}%</span>
            </div>

            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center backdrop-blur-md">
              <span className="text-[9px] font-mono text-white/40 block uppercase">Status</span>
              <span className="text-[11px] py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-sm font-black block mt-2 text-center">Done</span>
            </div>
          </div>

          {/* Master layout grid block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left side: Rankings leaderboard */}
            <div className="lg:col-span-12 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Final Standings Leaderboard</h3>
              </div>
              <LiveLeaderboard participants={activeParticipants} />
            </div>

            {/* Bottom 2 cols: Participant reports details table & click breakdowns */}
            <div className="lg:col-span-12 space-y-4">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-300" />
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Expand Participant Detailed Logs</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Roll logs panel */}
                <div className="md:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto font-sans text-xs space-y-2">
                  <span className="text-[9px] font-mono text-white/30 uppercase font-bold block mb-2">Select player to inspect report card</span>
                  
                  {activeParticipants.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedParticipant(p)}
                      className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        selectedParticipant?.id === p.id 
                          ? "bg-teal-400/10 border-teal-400 text-teal-300 font-bold" 
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div>
                        <span className="block font-bold text-white truncate max-w-[120px]">{p.name}</span>
                        {p.rollNumber && <span className="text-[10px] text-white/40 block font-mono">Roll: {p.rollNumber}</span>}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-white/50">Score: <strong className="text-white">{p.finalScore || 0}</strong></span>
                        <span className="text-teal-400">{Math.round(p.accuracy || 0)}%</span>
                      </div>
                    </button>
                  ))}
                </div>


                {/* Display inspection summary panel */}
                <div className="md:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 backdrop-blur-xl relative">
                  {selectedParticipant ? (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="border-b border-white/10 pb-3 flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-mono text-white/40 uppercase font-black">Participant inspection</span>
                          <h4 className="text-base font-black text-white mt-0.5">{selectedParticipant.name}</h4>
                          {selectedParticipant.email && <span className="text-[10px] text-white/50 block font-mono mt-0.5">Contact: {selectedParticipant.email}</span>}
                        </div>
                        <button
                          onClick={() => setSelectedParticipant(null)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <X className="w-4 h-4 text-white/50" />
                        </button>
                      </div>

                      {/* Performance card details */}
                      <div className="grid grid-cols-3 gap-2.5 text-xs text-center font-sans font-medium">
                        <div className="bg-black/20 border border-white/5 p-3 rounded-xl">
                          <span className="block text-white/40 text-[9px] uppercase font-mono">Final Marks</span>
                          <span className="block font-mono text-base font-bold text-white mt-1">
                            {selectedParticipant.finalScore || 0} <span className="text-[10px] text-white/40"> pts</span>
                          </span>
                        </div>
                        <div className="bg-black/20 border border-white/5 p-3 rounded-xl">
                          <span className="block text-white/40 text-[9px] uppercase font-mono">Accuracy</span>
                          <span className="block font-mono text-base font-bold text-teal-300 mt-1">
                            {Math.round(selectedParticipant.accuracy || 0)}%
                          </span>
                        </div>
                        <div className="bg-black/20 border border-white/5 p-3 rounded-xl">
                          <span className="block text-white/40 text-[9px] uppercase font-mono">Time Spent</span>
                          <span className="block font-mono text-base font-bold text-white mt-1">
                            {selectedParticipant.totalTime || 0}s
                          </span>
                        </div>
                      </div>

                      {/* Timeline responses loop */}
                      <div className="space-y-3 font-sans text-xs">
                        <span className="text-[9px] font-mono text-white/40 uppercase block">Choice timeline detail per-question</span>
                        
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {activeQuestions.map((q, qIndex) => {
                            const r = participantReportResponses.find(res => res.questionId === q.id);
                            const wasCorrect = r?.selectedOption === q.answer;

                            return (
                              <div
                                key={q.id}
                                className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-start justify-between gap-4 text-xs font-sans font-medium"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono bg-white/5 py-0.5 px-2 rounded-sm text-[10px] text-white/45">
                                      Q{qIndex + 1}
                                    </span>
                                    <span className="font-bold text-white line-clamp-1">{q.text}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-[10px] font-mono text-white/45">
                                    <span>Selected: <strong className={wasCorrect ? "text-emerald-400" : "text-amber-400"}>{r?.selectedOption || "Skipped"}</strong></span>
                                    <span>Correct Index: <strong>{q.answer}</strong></span>
                                    <span>Spent: <strong>{r?.timeTaken || q.timeLimit}s</strong></span>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center justify-center font-bold">
                                  {wasCorrect ? (
                                    <span className="text-emerald-400 flex items-center gap-0.5 font-mono text-[10px] bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                      +{q.marks}
                                    </span>
                                  ) : r?.selectedOption == null ? (
                                    <span className="text-white/40 flex items-center gap-0.5 font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                                      0
                                    </span>
                                  ) : (
                                    <span className="text-red-400 flex items-center gap-0.5 font-mono text-[10px] bg-red-400/10 px-1.5 py-0.5 rounded">
                                      {selectedQuiz?.settings?.negativeMarking ? `-${Math.abs(q.marks * (selectedQuiz.settings?.negativeMarkFraction || 0.25))}` : "0"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="py-20 border border-dashed border-white/5 rounded-2xl text-center text-white/30 flex flex-col justify-center items-center font-medium">
                      <Info className="w-8 h-8 text-white/20 mb-2" />
                      <span className="text-xs">Click on any participant card on the left list to load aggregate records</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

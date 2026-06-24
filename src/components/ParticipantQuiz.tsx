import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { 
  doc, 
  collection, 
  getDoc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc 
} from "firebase/firestore";
import { Participant, Quiz, Question, ParticipantResponse } from "../types";
import { sanitizeFirestoreData } from "../utils/firestoreSanitizer";
import { calculatePoints } from "../utils/scoringEngine";
import { 
  Play, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Timer, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  User, 
  Hash, 
  Mail, 
  HelpCircle, 
  Bookmark, 
  Sparkles,
  Wifi,
  WifiOff
} from "lucide-react";
import LiveLeaderboard from "./LiveLeaderboard";
import { motion, AnimatePresence } from "motion/react";

// Sandbox-safe Storage Helper to avoid parent Frame SecurityError exceptions
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

const CountUpPoints = ({ targetValue }: { targetValue: number }) => {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (targetValue <= 0) {
      setCurrent(0);
      return;
    }
    let start = 0;
    const duration = 800; // 0.8 seconds duration
    const stepTime = 15;
    const steps = Math.floor(duration / stepTime);
    const increment = Math.ceil(targetValue / steps);
    
    let timer = setInterval(() => {
      start += increment;
      if (start >= targetValue) {
        setCurrent(targetValue);
        clearInterval(timer);
      } else {
        setCurrent(start);
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [targetValue]);

  return <span className="font-black text-3xl md:text-5xl text-teal-400 font-mono">+{current}</span>;
};

interface ParticipantQuizProps {
  quizIdParam: string;
  onExit: () => void;
}

export default function ParticipantQuiz({ quizIdParam, onExit }: ParticipantQuizProps) {
  // Input fields for joining
  const [joinCode, setJoinCode] = useState(quizIdParam || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  
  // State variables for active session
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [savedResponses, setSavedResponses] = useState<Record<string, ParticipantResponse>>({});
  
  // Navigation & interaction
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  
  // Timers
  const [overallTimeLeft, setOverallTimeLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  
  // Statuses
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Feedback popup state for scoring mode
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    isCorrect: boolean;
    pointsAwarded: number;
    timeTakenSec: number;
  } | null>(null);
  
  // Overall statistics upon completion
  const [quizStats, setQuizStats] = useState<any>(null);
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  const activeQuestionRef = useRef<number>(0);
  const overallIntervalRef = useRef<any>(null);
  const questionIntervalRef = useRef<any>(null);
  const lastQuestionTimeRef = useRef<number>(0);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync recovery: check if we are already logged in to an ongoing quiz session
  useEffect(() => {
    if (quizIdParam) {
      const recoveredId = safeStorage.getItem(`qz_p_${quizIdParam}`);
      if (recoveredId) {
        retrieveSession(quizIdParam, recoveredId);
      }
    }
  }, [quizIdParam]);

  const retrieveSession = async (qId: string, pId: string) => {
    setLoading(true);
    try {
      const quizRef = doc(db, "quizzes", qId);
      const quizSnap = await getDoc(quizRef);
      if (!quizSnap.exists()) {
        safeStorage.removeItem(`qz_p_${qId}`);
        setLoading(false);
        return;
      }
      const quizData = { id: quizSnap.id, ...quizSnap.data() } as Quiz;
      setQuiz(quizData);

      const pRef = doc(db, "quizzes", qId, "participants", pId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const pData = pSnap.data() as Participant;
        setParticipant({ id: pSnap.id, ...pData });
        
        // Load questions
        const qCol = collection(db, "quizzes", qId, "questions");
        const qSnap = await getDocs(qCol);
        const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Question }));
        qList.sort((a, b) => a.order - b.order);
        setQuestions(qList);

        // Load existing answers
        const respCol = collection(db, "quizzes", qId, "responses");
        const respSnap = await getDocs(respCol);
        const respMap: Record<string, ParticipantResponse> = {};
        respSnap.docs.forEach(doc => {
          const resp = doc.data() as ParticipantResponse;
          if (resp.participantId === pId) {
            respMap[resp.questionId] = resp;
          }
        });
        setSavedResponses(respMap);

        setIsJoined(true);
        if (pData.status === "Completed") {
          calculateFinalResult(pData, qList, respMap);
        }
      }
    } catch (err) {
      console.error("Sync recovery failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Listen for Live Host Changes (Pause, Resume, End, activeQuestionIndex)
  useEffect(() => {
    if (isJoined && quiz?.id) {
      const unsub = onSnapshot(doc(db, "quizzes", quiz.id), (docSnap) => {
        if (docSnap.exists()) {
          const updatedQuiz = { id: docSnap.id, ...docSnap.data() } as Quiz;
          setQuiz(updatedQuiz);
          
          if (updatedQuiz.status === "Completed" && participant?.status !== "Completed") {
            // Auto submit when host completes quiz
            autosubmitQuiz();
          }
        }
      });
      return () => unsub();
    }
  }, [isJoined, quiz?.id, participant?.id]);

  // Overall Timer Effect
  useEffect(() => {
    if (isJoined && participant && quiz && quiz.status === "Live" && !quiz.paused && participant.status === "In Progress") {
      const maxDuration = 30 * 60; // default 30 mins
      const elapsed = Math.floor((Date.now() - participant.startTime) / 1000);
      const initialRemaining = Math.max(0, maxDuration - elapsed);
      setOverallTimeLeft(initialRemaining);

      overallIntervalRef.current = setInterval(() => {
        setOverallTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(overallIntervalRef.current);
            autosubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (overallIntervalRef.current) clearInterval(overallIntervalRef.current);
    }

    return () => {
      if (overallIntervalRef.current) clearInterval(overallIntervalRef.current);
    };
  }, [isJoined, quiz?.status, quiz?.paused, participant?.status]);

  // Per Question Timer Effect
  useEffect(() => {
    if (isJoined && participant && quiz && quiz.status === "Live" && !quiz.paused && participant.status === "In Progress" && questions.length > 0) {
      const q = questions[currentIndex];
      if (q) {
        // Load the previously spent time or set maximum limit
        const previousResponse = savedResponses[q.id];
        let baseRemaining = q.timeLimit;
        
        if (previousResponse && previousResponse.timeTaken) {
          // Subtract spent time from limit if allowed to review, otherwise lock it
          baseRemaining = Math.max(0, q.timeLimit - previousResponse.timeTaken);
        }

        setQuestionTimeLeft(baseRemaining);
        lastQuestionTimeRef.current = Date.now();

        if (questionIntervalRef.current) clearInterval(questionIntervalRef.current);

        questionIntervalRef.current = setInterval(() => {
          setQuestionTimeLeft((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(questionIntervalRef.current);
              handleQuestionTimeOut();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      if (questionIntervalRef.current) clearInterval(questionIntervalRef.current);
    }

    return () => {
      if (questionIntervalRef.current) clearInterval(questionIntervalRef.current);
    };
  }, [currentIndex, isJoined, quiz?.status, quiz?.paused, participant?.status, questions]);

  // Handle Question Selection UI State Synchronization
  useEffect(() => {
    if (questions.length > 0 && isJoined) {
      const q = questions[currentIndex];
      const saved = savedResponses[q.id];
      setSelectedOption(saved ? saved.selectedOption : null);
    }
  }, [currentIndex, savedResponses, questions, isJoined]);

  // Join the Quiz as a contestant
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!name.trim()) {
      setError("Please input a display name.");
      setLoading(false);
      return;
    }

    const cleanCode = joinCode.trim().toUpperCase();

    try {
      const quizRef = doc(db, "quizzes", cleanCode);
      const quizSnap = await getDoc(quizRef);

      if (!quizSnap.exists()) {
        setError("Quiz not found. Please verify the code/PIN.");
        setLoading(false);
        return;
      }

      const quizData = { id: quizSnap.id, ...quizSnap.data() } as Quiz;
      if (quizData.status === "Draft") {
        setError("This quiz is in Draft and is not ready for entries yet.");
        setLoading(false);
        return;
      }

      // Check participant threshold limit
      const pCol = collection(db, "quizzes", cleanCode, "participants");
      const currentParticipantsSnap = await getDocs(pCol);
      if (quizData.settings?.maxParticipants && currentParticipantsSnap.size >= quizData.settings.maxParticipants) {
        setError(`This quiz room is fully occupied. (Limit: ${quizData.settings.maxParticipants} participants)`);
        setLoading(false);
        return;
      }

      setQuiz(quizData);

      // Store Participant Profile session
      const pId = Math.random().toString(36).substring(2, 11);
      const newParticipant: Participant = {
        id: pId,
        quizId: cleanCode,
        name: name.trim(),
        email: email.trim() || undefined,
        rollNumber: rollNumber.trim() || undefined,
        startTime: Date.now(),
        status: "Joined",
        lastActive: Date.now()
      };

      await setDoc(doc(db, "quizzes", cleanCode, "participants", pId), sanitizeFirestoreData(newParticipant));
      setParticipant(newParticipant);

      // Save key in localStorage for browser tab disconnect preservation
      safeStorage.setItem(`qz_p_${cleanCode}`, pId);

      // Load Quiz Questions
      const qCol = collection(db, "quizzes", cleanCode, "questions");
      const qSnap = await getDocs(qCol);
      const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Question }));
      qList.sort((a, b) => a.order - b.order);
      setQuestions(qList);

      setIsJoined(true);
    } catch (err: any) {
      setError(`Failed to join: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Start the actual countdown & test questions
  const startQuizExperience = async () => {
    if (!quiz || !participant) return;
    setStarting(true);
    try {
      const pRef = doc(db, "quizzes", quiz.id, "participants", participant.id);
      const updateData = {
        status: "In Progress",
        startTime: Date.now()
      };
      await updateDoc(pRef, sanitizeFirestoreData(updateData));
      setParticipant(prev => prev ? { ...prev, status: "In Progress", startTime: Date.now() } : null);
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  // Option selection logic: instantly records response to Firestore
  const handleSelectOption = async (option: "A" | "B" | "C" | "D") => {
    if (!quiz || !participant || participant.status !== "In Progress" || quiz.paused) return;

    setSelectedOption(option);
    const q = questions[currentIndex];
    
    // Time taken to select current option
    const elapsedSinceQuestionStart = Math.min(q.timeLimit, Math.floor((Date.now() - lastQuestionTimeRef.current) / 1000));
    const previousSpent = savedResponses[q.id]?.timeTaken || 0;
    const totalTimeForQ = Math.min(q.timeLimit, previousSpent + elapsedSinceQuestionStart);

    const isCorrect = option === q.answer;
    
    // Calculate using robust Scoring Engine
    const scoringResult = calculatePoints({
      isCorrect,
      timeTakenSec: totalTimeForQ,
      timeLimitSec: q.timeLimit,
      scoringMode: quiz.settings?.scoringMode || "fixed",
      maxPoints: quiz.settings?.maxPoints ?? 1000,
      minPoints: quiz.settings?.minPoints ?? 0,
      scoringCurve: quiz.settings?.scoringCurve || "linear",
      questionMarks: q.marks,
      negativeMarkingEnabled: !!quiz.settings?.negativeMarking,
      negativeFraction: quiz.settings?.negativeMarkFraction || 0.25,
    });

    // Set interactive pop-up response feedback data
    setFeedbackData({
      isCorrect,
      pointsAwarded: scoringResult.awardedPoints,
      timeTakenSec: totalTimeForQ
    });
    setShowFeedbackPopup(true);

    const responseDoc: ParticipantResponse = {
      id: `${participant.id}_${q.id}`,
      quizId: quiz.id,
      participantId: participant.id,
      questionId: q.id,
      selectedOption: option,
      correctOption: q.answer,
      isCorrect,
      marksAwarded: scoringResult.awardedPoints,
      timeTaken: totalTimeForQ || 1,
      submittedAt: Date.now(),
      skipped: false,
      visited: true,
      responseTimeMs: scoringResult.responseTimeMs,
      remainingTimeMs: scoringResult.remainingTimeMs,
      maxPoints: scoringResult.maxPointsPossible,
      awardedPoints: scoringResult.awardedPoints,
    };

    // Optimistic Save
    setSavedResponses(prev => ({
      ...prev,
      [q.id]: responseDoc
    }));

    try {
      await setDoc(doc(db, "quizzes", quiz.id, "responses", `${participant.id}_${q.id}`), sanitizeFirestoreData(responseDoc));
    } catch (err) {
      console.error("Firestore offline, item cached in states:", err);
    }
  };

  // Save skip on next/previous/skipped action
  const recordVisitOrSkip = async (isSkipAction = false) => {
    if (!quiz || !participant || questions.length === 0) return;
    const q = questions[currentIndex];
    if (savedResponses[q.id]?.selectedOption) return; // already answered

    const elapsed = Math.min(q.timeLimit, Math.floor((Date.now() - lastQuestionTimeRef.current) / 1000));
    const previousSpent = savedResponses[q.id]?.timeTaken || 0;
    const totalTimeForQ = Math.min(q.timeLimit, previousSpent + elapsed);

    const responseDoc: ParticipantResponse = {
      id: `${participant.id}_${q.id}`,
      quizId: quiz.id,
      participantId: participant.id,
      questionId: q.id,
      selectedOption: null,
      correctOption: q.answer,
      isCorrect: false,
      marksAwarded: 0,
      timeTaken: totalTimeForQ || 1,
      submittedAt: Date.now(),
      skipped: isSkipAction,
      visited: true,
      responseTimeMs: Math.round((totalTimeForQ || 1) * 1000),
      remainingTimeMs: Math.round(Math.max(0, q.timeLimit - totalTimeForQ) * 1000),
      maxPoints: quiz.settings?.scoringMode === "dynamic" ? (quiz.settings?.maxPoints ?? 1000) : q.marks,
      awardedPoints: 0
    };

    setSavedResponses(prev => ({
      ...prev,
      [q.id]: responseDoc
    }));

    try {
      await setDoc(doc(db, "quizzes", quiz.id, "responses", `${participant.id}_${q.id}`), sanitizeFirestoreData(responseDoc));
    } catch (err) {
      console.error(err);
    }
  };

  // Move to next question
  const handleNext = async () => {
    await recordVisitOrSkip(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Prompt submit confirmation if they are on the last question
    }
  };

  const handlePrevious = async () => {
    await recordVisitOrSkip(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSkip = async () => {
    await recordVisitOrSkip(true);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const toggleMarkForReview = () => {
    const q = questions[currentIndex];
    setMarkedForReview(prev => ({
      ...prev,
      [q.id]: !prev[q.id]
    }));
  };

  // Lock and advance when singular MCQ slide timer hits zero
  const handleQuestionTimeOut = async () => {
    await recordVisitOrSkip(true);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      autosubmitQuiz();
    }
  };

  // Submit test and compute immediate final score metrics
  const autosubmitQuiz = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (questionIntervalRef.current) clearInterval(questionIntervalRef.current);
    if (overallIntervalRef.current) clearInterval(overallIntervalRef.current);

    const currentQuizId = quiz?.id || joinCode.trim().toUpperCase();
    const currentParticipantId = participant?.id;

    if (!currentQuizId || !currentParticipantId) {
      setSubmitting(false);
      return;
    }

    try {
      // 1. Gather all questions
      let activeQuestions = questions;
      if (activeQuestions.length === 0) {
        const qCol = collection(db, "quizzes", currentQuizId, "questions");
        const qSnap = await getDocs(qCol);
        activeQuestions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Question }));
        activeQuestions.sort((a, b) => a.order - b.order);
      }

      // 2. Fetch all raw submission responses
      const rCol = collection(db, "quizzes", currentQuizId, "responses");
      const rSnap = await getDocs(rCol);
      const responsesList = rSnap.docs
        .map(doc => doc.data() as ParticipantResponse)
        .filter(r => r.participantId === currentParticipantId);

      const responseMap: Record<string, ParticipantResponse> = {};
      responsesList.forEach(r => responseMap[r.questionId] = r);

      // Fill in any unanswered gaps
      activeQuestions.forEach(q => {
        if (!responseMap[q.id]) {
          responseMap[q.id] = {
            id: `${currentParticipantId}_${q.id}`,
            quizId: currentQuizId,
            participantId: currentParticipantId,
            questionId: q.id,
            selectedOption: null,
            correctOption: q.answer,
            isCorrect: false,
            marksAwarded: 0,
            timeTaken: q.timeLimit,
            submittedAt: Date.now(),
            skipped: true,
            visited: false,
            responseTimeMs: q.timeLimit * 1000,
            remainingTimeMs: 0,
            maxPoints: quiz?.settings?.scoringMode === "dynamic" ? (quiz?.settings?.maxPoints ?? 1000) : q.marks,
            awardedPoints: 0
          };
        }
      });

      // 3. Score calculation
      let score = 0;
      let corrects = 0;
      let wrongs = 0;
      let skips = 0;
      let totalAssignedSeconds = 0;
      let responseTimes: number[] = [];

      for (const q of activeQuestions) {
        const r = responseMap[q.id];
        const isCorrect = r.selectedOption === q.answer;
        const isSkipped = r.selectedOption === null;

        const scoringResult = calculatePoints({
          isCorrect,
          timeTakenSec: r.timeTaken || 0,
          timeLimitSec: q.timeLimit,
          scoringMode: quiz?.settings?.scoringMode || "fixed",
          maxPoints: quiz?.settings?.maxPoints ?? 1000,
          minPoints: quiz?.settings?.minPoints ?? 0,
          scoringCurve: quiz?.settings?.scoringCurve || "linear",
          questionMarks: q.marks,
          negativeMarkingEnabled: isSkipped ? false : !!quiz?.settings?.negativeMarking,
          negativeFraction: quiz?.settings?.negativeMarkFraction || 0.25,
        });

        r.marksAwarded = scoringResult.awardedPoints;
        r.responseTimeMs = scoringResult.responseTimeMs;
        r.remainingTimeMs = scoringResult.remainingTimeMs;
        r.maxPoints = scoringResult.maxPointsPossible;
        r.awardedPoints = scoringResult.awardedPoints;

        totalAssignedSeconds += r.timeTaken || 0;
        if (!isSkipped) {
          responseTimes.push(r.timeTaken || 0);
        }

        if (isCorrect) {
          corrects++;
        } else if (isSkipped) {
          skips++;
        } else {
          wrongs++;
        }
        score += scoringResult.awardedPoints;

        // Save back full sanitized response details to Firestore
        await setDoc(doc(db, "quizzes", currentQuizId, "responses", r.id), sanitizeFirestoreData(r));
      }

      const fastest = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
      const slowest = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
      const avgResponse = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

      const totalPossibleScore = activeQuestions.reduce((acc, current) => {
        if (quiz?.settings?.scoringMode === "dynamic") {
          return acc + (quiz?.settings?.maxPoints ?? 1000);
        }
        return acc + current.marks;
      }, 0);
      const percentageScored = totalPossibleScore > 0 ? (score / totalPossibleScore) * 100 : 0;
      const computedAccuracy = (corrects + wrongs) > 0 ? (corrects / (corrects + wrongs)) * 100 : 0;

      const updatedParticipant: Partial<Participant> = {
        endTime: Date.now(),
        totalTime: totalAssignedSeconds,
        finalScore: Math.round(score * 100) / 100,
        accuracy: computedAccuracy,
        correctCount: corrects,
        wrongCount: wrongs,
        skippedCount: skips,
        percentage: Math.max(0, Math.round(percentageScored * 100) / 100),
        status: "Completed",
        lastActive: Date.now(),
        averageResponseTime: Math.round(avgResponse * 100) / 100,
        fastestResponse: Math.round(fastest * 100) / 100,
        slowestResponse: Math.round(slowest * 100) / 100,
        totalDynamicPoints: quiz?.settings?.scoringMode === "dynamic" ? score : 0
      };

      // Record final data to server
      const pDocRef = doc(db, "quizzes", currentQuizId, "participants", currentParticipantId);
      await updateDoc(pDocRef, sanitizeFirestoreData(updatedParticipant));

      setParticipant(prev => prev ? { ...prev, ...updatedParticipant as Participant } : null);
      calculateFinalResult({ ...participant, ...updatedParticipant } as Participant, activeQuestions, responseMap);
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Prepare result panels and confetti bursts
  const calculateFinalResult = (p: Participant, qList: Question[], rMap: Record<string, ParticipantResponse>) => {
    const totalMarksPossible = qList.reduce((acc, q) => acc + q.marks, 0);
    setQuizStats({
      score: p.finalScore ?? 0,
      accuracy: p.accuracy ?? 0,
      totalTime: p.totalTime ?? 0,
      maxMarks: totalMarksPossible,
      correct: p.correctCount ?? 0,
      wrong: p.wrongCount ?? 0,
      skipped: p.skippedCount ?? 0,
      percentage: p.percentage ?? 0
    });

    // Populate confetti sparkles state for beautiful visual effect
    const particles = Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage of the screen width
      delay: Math.random() * 3, // seconds
      color: ["#14b8a6", "#3b82f6", "#eab308", "#ec4899", "#8b5cf6", "#10b981"][Math.floor(Math.random() * 6)]
    }));
    setConfettiParticles(particles);
  };

  const handleLeaveRoom = () => {
    if (quiz?.id) {
      safeStorage.removeItem(`qz_p_${quiz.id}`);
    }
    onExit();
  };

  // CSS for floating dynamic confetti
  const confettiCss = `
    @keyframes fall-gravity {
      0% {
        transform: translateY(-20px) rotate(0deg) scale(0.5);
        opacity: 1;
      }
      50% {
        opacity: 0.8;
      }
      100% {
        transform: translateY(100vh) rotate(720deg) scale(1);
        opacity: 0;
      }
    }
    .custom-confetti {
      position: absolute;
      width: 8px;
      height: 16px;
      top: -20px;
      border-radius: 3px;
      pointer-events: none;
      animation: fall-gravity 4s linear infinite;
    }
  `;

  // ---------------- RENDERS ----------------

  // 1. Loading Phase
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        <p className="text-sm font-mono text-white/50">Fetching quiz credentials and state...</p>
      </div>
    );
  }

  // 2. Joining Prompt (If not joined/resolved yet)
  if (!isJoined) {
    return (
      <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: confettiCss }} />
        {/* Decorative backdrop */}
        <div className="absolute top-[-50px] right-[-50px] w-36 h-36 rounded-full bg-teal-500/10 blur-xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-teal-400/10 rounded-full text-teal-400 mb-3">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white font-sans mt-1">Join Live Quiz Room</h2>
          <p className="text-[11px] text-white/50 tracking-normal mt-1">
            Input a 6-digit invitation access code and participant credentials to register.
          </p>
        </div>

        {error && (
          <div className="mb-5 border border-red-500/20 bg-red-500/10 text-red-200 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4 font-sans text-xs">
          <div>
            <label className="text-white/60 font-semibold mb-1.5 block">Access Code/PIN</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-white/30 font-mono font-bold">#</span>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="QZK50B"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-8 pr-4 text-white font-mono font-bold uppercase tracking-wider text-sm focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-white/60 font-semibold mb-1.5 block">Display Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-white/60 font-semibold mb-1.5 block">Roll Number (Optional)</label>
            <div className="relative">
              <Hash className="absolute left-3.5 top-3 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="2026-CSE-109"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <div>
            <label className="text-white/60 font-semibold mb-1.5 block">Email Address (Optional)</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@college.edu"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-teal-400/50 outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-400 hover:bg-teal-500 active:scale-95 text-black font-semibold rounded-xl py-3 px-4 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:bg-teal-400/50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 shrink-0" />}
            <span>Enter Room</span>
          </button>
          
          <button
            type="button"
            onClick={onExit}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-2.5 text-white transition-all text-center text-[11px] font-medium"
          >
            Back to main hub
          </button>
        </form>
      </div>
    );
  }

  // 3. Instruction & Waiting Screen (Status == Joined)
  if (participant?.status === "Joined") {
    const totalPossiblePoints = questions.reduce((acc, q) => acc + q.marks, 0);
    return (
      <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative">
        <div className="text-center md:text-left border-b border-white/10 pb-5 mb-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="px-2 py-0.5 rounded-sm bg-teal-400/10 text-teal-400 text-[9px] font-mono font-bold uppercase tracking-wider">
              {quiz?.category || "General"}
            </span>
            <h2 className="text-2xl font-black text-white mt-1 capitalize">{quiz?.name}</h2>
            <p className="text-xs text-white/50 leading-relaxed mt-0.5">{quiz?.description}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center shrink-0 w-28">
            <span className="text-[9px] font-mono uppercase text-white/40 font-semibold block">Difficulty</span>
            <span className="text-sm font-black text-white leading-none block mt-1">{quiz?.difficulty || "Medium"}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase">Quiz Guidelines</h3>
          
          <div className="grid grid-cols-2 gap-3 font-sans text-xs">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-white/40 block text-[10px]">Total MCQs</span>
              <span className="text-base font-bold text-white block mt-0.5">{questions.length} Questions</span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-white/40 block text-[10px]">Total Score Weight</span>
              <span className="text-base font-bold text-white block mt-0.5">{totalPossiblePoints} Marks</span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 col-span-2">
              <span className="text-white/40 block text-[10px] flex items-center gap-1">
                <Timer className="w-3 h-3 text-white/50" />
                <span>Timer Restrictions</span>
              </span>
              <p className="text-white/75 mt-1 leading-relaxed text-[11px]">
                Both overall exam duration limit and individual question slide timers apply. Questions auto-lock or advance if timers hit zero.
              </p>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-2 mt-4">
            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Resilient Disconnect Preserves API</span>
            </h4>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              If your browser triggers an unexpected restart or internet drops, do not panic! Access options auto-save instantly. Just re-enter the Join Access PIN <strong>{quiz?.id}</strong> to pick up right where you left off.
            </p>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button
              onClick={startQuizExperience}
              disabled={starting}
              className="flex-1 bg-teal-400 hover:bg-teal-500 active:scale-95 text-black font-semibold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-teal-400/50"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing Lobby...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Start Quiz Now</span>
                </>
              )}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl border border-white/5 transition-all cursor-pointer"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Completed Page (Status == Completed)
  if (participant?.status === "Completed") {
    return (
      <div className="max-w-3xl mx-auto space-y-8 relative">
        <style dangerouslySetInnerHTML={{ __html: confettiCss }} />
        {/* Render Floating Confetti Particles if scoring high */}
        {(quizStats?.accuracy ?? 0) >= 50 && confettiParticles.map((p) => (
          <div
            key={p.id}
            className="custom-confetti"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              backgroundColor: p.color
            }}
          />
        ))}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center relative overflow-hidden space-y-6">
          <div className="absolute top-[-80px] left-[-80px] w-48 h-48 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

          <div className="space-y-2">
            <div className="inline-flex p-3 bg-teal-400/10 rounded-full text-teal-400">
              <CheckCircle className="w-10 h-10 drop-shadow-[0_0_8px_rgba(20,184,166,0.3)] animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-white">Quiz Completed!</h2>
            <p className="text-xs text-white/50">Your final answers were compiled and securely archived on Firestore</p>
          </div>

          {quizStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto pt-2">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">Final Score</span>
                <span className="text-lg font-black text-white block mt-1">
                  {quizStats.score} <span className="text-xs text-white/40">/ {quizStats.maxMarks}</span>
                </span>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">Accuracy</span>
                <span className="text-lg font-black text-teal-400 block mt-1">
                  {Math.round(quizStats.accuracy)}%
                </span>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">Questions Solved</span>
                <span className="text-lg font-black text-white block mt-1">
                  {quizStats.correct} <span className="text-xs text-white/30">C</span> · {quizStats.wrong} <span className="text-xs text-white/30">W</span>
                </span>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">Total Duration</span>
                <span className="text-lg font-black text-white block mt-1">
                  {quizStats.totalTime}s
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center items-center font-semibold text-xs max-w-xs mx-auto">
            <button
              onClick={handleLeaveRoom}
              className="w-full bg-teal-400 hover:bg-teal-500 text-black py-2.5 px-4 rounded-xl transition-all cursor-pointer text-center"
            >
              Back to Home Menu
            </button>
          </div>
        </div>

        {/* Live Leaderboard position */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Live Quiz Leaderboard</h3>
          </div>
          {/* We can listen to live standings directly */}
          <LeaderboardListener quizId={quiz?.id || joinCode.trim().toUpperCase()} />
        </div>
      </div>
    );
  }

  // 5. Active Test Screen (Status == In Progress)
  if (participant?.status === "In Progress" && questions.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-4">
        <div className="inline-flex p-3 bg-red-500/10 rounded-full text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white">No Questions Available</h3>
        <p className="text-xs text-white/50 leading-relaxed">
          This quiz contains no questions. Please contact the host or try again later.
        </p>
        <button
          onClick={handleLeaveRoom}
          className="w-full bg-teal-400 hover:bg-teal-500 text-black py-2.5 px-4 rounded-xl transition-all cursor-pointer text-center font-semibold text-xs"
        >
          Back to Home Menu
        </button>
      </div>
    );
  }

  if (participant?.status === "In Progress" && questions.length > 0) {
    const q = questions[currentIndex];
    const progressPercent = ((currentIndex + 1) / questions.length) * 100;
    
    // Check if quiz is paused by Host
    const isPaused = quiz?.paused === true;

    return (
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* NETWORK & OFFLINE ALERTS */}
        {!isOnline && (
          <div className="lg:col-span-12 border border-amber-500/20 bg-amber-500/10 text-amber-200 text-[11px] py-2 px-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Network offline. Auto-saving will cache changes locally and re-sync on reconnection.</span>
            </div>
            <span className="font-bold underline text-amber-300">Offline Caching Enabled</span>
          </div>
        )}

        {/* PAUSE BLOCKER */}
        {isPaused && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center max-w-sm space-y-4">
              <div className="inline-flex p-3 bg-amber-500/10 rounded-full text-amber-500">
                <Clock className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-black text-white">Quiz Paused by Host</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                The administrator has suspended inputs temporarily. Your timers are frozen. Do not refresh; the session will resume instantly as soon as active status status changes.
              </p>
              <div className="font-mono text-[9px] text-teal-400/70 uppercase tracking-widest font-black">
                WAITING FOR HOST...
              </div>
            </div>
          </div>
        )}

        {/* Left main: Question Deck block */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative space-y-6">
            {/* Nav card header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-white/40 text-[10px] uppercase font-mono tracking-widest">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="font-bold ml-2.5 text-xs text-teal-400 font-mono bg-teal-400/10 px-2 py-0.5 rounded-sm">
                  {q.marks} Marks
                </span>
                {markedForReview[q.id] && (
                  <span className="font-bold ml-1.5 text-xs text-amber-400 font-mono bg-amber-400/15 px-2 py-0.5 rounded-sm inline-flex items-center gap-0.5">
                    <Bookmark className="w-3 h-3 text-amber-400 shrink-0" />
                    Review
                  </span>
                )}
              </div>
              {/* Individual Timer */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 py-1.5 px-3 rounded-full text-white shrink-0">
                <Timer className={`w-3.5 h-3.5 ${questionTimeLeft !== null && questionTimeLeft <= 10 ? "text-red-400 animate-pulse" : "text-teal-400"}`} />
                <span className={`text-xs font-mono font-bold ${questionTimeLeft !== null && questionTimeLeft <= 10 ? "text-red-400" : "text-white"}`}>
                  {questionTimeLeft ?? 0}s
                </span>
              </div>
            </div>

            {/* Dynamic visual slider progress */}
            <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-teal-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Question title text */}
            <h1 className="text-base md:text-lg font-black text-white leading-relaxed tracking-tight">
              {q.text}
            </h1>

            {/* A, B, C, D Option Deck */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {(["A", "B", "C", "D"] as const).map((opt) => {
                const optText = q.options[opt];
                if (!optText) return null;
                const isSelected = selectedOption === opt;

                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full flex items-start gap-3.5 p-4 rounded-xl text-left border text-xs font-medium transition-all outline-none cursor-pointer group active:scale-[0.98] ${
                      isSelected
                        ? "bg-teal-400/10 border-teal-400 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span 
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 font-mono transition-colors ${
                        isSelected
                          ? "bg-teal-400 text-black"
                          : "bg-white/10 text-white/60 group-hover:bg-white/20"
                      }`}
                    >
                      {opt}
                    </span>
                    <span className="leading-relaxed pt-0.5">{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Direction Navigation Footer buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white py-2 px-3 rounded-lg border border-white/5 transition-all outline-none cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                
                <button
                  onClick={toggleMarkForReview}
                  className={`py-2 px-3 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    markedForReview[q.id]
                      ? "bg-amber-400/20 border-amber-400 text-amber-300"
                      : "bg-white/5 hover:bg-white/10 border-white/5 text-white/70"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 shrink-0" />
                  <span>{markedForReview[q.id] ? "Marked" : "Mark Review"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSkip}
                  className="bg-white/5 hover:bg-white/10 text-white/50 hover:text-white py-2 px-3 rounded-lg border border-white/5 transition-all text-[11px] font-semibold cursor-pointer"
                >
                  Skip MCQ
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="bg-teal-400 hover:bg-teal-500 text-black py-2 px-3.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={autosubmitQuiz}
                    disabled={submitting}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    <span>Submit Answers</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right aside side: overall progress indices */}
        <div className="lg:col-span-4 space-y-6">
          {/* Overall remaining timer */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Clock className="w-4 h-4 text-teal-400" />
              <div className="leading-tight">
                <span className="text-[10px] text-white/40 block font-mono uppercase font-bold tracking-wider">Exam Duration</span>
                <span className="text-xs font-black">Allotment Clock</span>
              </div>
            </div>
            
            <div className="font-mono text-base font-black text-white px-3 py-1 rounded bg-black/40 border border-white/5">
              {overallTimeLeft !== null ? (
                <>
                  {Math.floor(overallTimeLeft / 60).toString().padStart(2, "0")}
                  <span className="animate-pulse text-teal-400">:</span>
                  {(overallTimeLeft % 60).toString().padStart(2, "0")}
                </>
              ) : (
                "00:00"
              )}
            </div>
          </div>

          {/* Index grids map */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <h4 className="text-[10px] font-mono uppercase text-white/40 font-bold tracking-wider">
              MCQ Traversal Grid
            </h4>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 gap-2">
              {questions.map((question, idx) => {
                const answerRecord = savedResponses[question.id];
                const isSelected = answerRecord?.selectedOption !== null && answerRecord?.selectedOption !== undefined;
                const isCurrent = idx === currentIndex;
                const isReview = markedForReview[question.id] === true;

                let btnStyle = "bg-white/5 border-white/10 hover:bg-white/10 text-white/60";
                if (isSelected) {
                  btnStyle = "bg-teal-400/20 border-teal-400/50 text-teal-400 font-bold";
                }
                if (isReview) {
                  btnStyle = "bg-amber-400/20 border-amber-400/50 text-amber-300 font-bold";
                }
                if (isCurrent) {
                  btnStyle = "border-white bg-white/10 text-white font-extrabold shadow-sm ring-1 ring-white/20";
                }

                return (
                  <button
                    key={question.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer outline-none relative ${btnStyle}`}
                  >
                    <span>{idx + 1}</span>
                    {isReview && isSelected && (
                      <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Visual indicators guide footer */}
            <div className="border-t border-white/5 pt-3.5 space-y-2 text-[10px] text-white/50 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-teal-400/20 border border-teal-400/50 inline-block" />
                <span>Solved (Logged to Firestore)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-amber-400/20 border border-amber-400/50 inline-block" />
                <span>Marked for review details</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-white/5 border border-white/10 inline-block" />
                <span>Unvisited slides</span>
              </div>
            </div>
          </div>
        </div>

        {/* Animated Correct / Incorrect Score Popup */}
        <AnimatePresence>
          {showFeedbackPopup && feedbackData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowFeedbackPopup(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="bg-[#0a1120] border-2 border-white/15 rounded-3xl p-6 md:p-8 text-center max-w-sm w-full space-y-6 shadow-2xl relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Decorative gradients */}
                {feedbackData.isCorrect ? (
                  <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent pointer-events-none" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent pointer-events-none" />
                )}

                <div className="space-y-2">
                  <div className="flex justify-center">
                    {feedbackData.isCorrect ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.4 }}
                        className="p-4 bg-teal-500/10 text-teal-400 rounded-full border border-teal-500/20"
                      >
                        <CheckCircle className="w-12 h-12" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.4 }}
                        className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20"
                      >
                        <AlertTriangle className="w-12 h-12" />
                      </motion.div>
                    )}
                  </div>

                  <h3 className={`text-2xl font-black ${feedbackData.isCorrect ? "text-teal-400" : "text-red-500"}`}>
                    {feedbackData.isCorrect ? "Correct!" : "Incorrect"}
                  </h3>
                </div>

                <div className="bg-black/30 py-4 px-6 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider block">Awarded Points</span>
                  <div className="flex items-center justify-center gap-1">
                    {feedbackData.isCorrect ? (
                      <CountUpPoints targetValue={feedbackData.pointsAwarded} />
                    ) : (
                      <span className="font-black text-3xl md:text-5xl text-red-500 font-mono">
                        {feedbackData.pointsAwarded}
                      </span>
                    )}
                    <span className="text-white/40 text-xs font-bold pt-2.5">pts</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-xs text-white/60">
                    Response time:{" "}
                    <span className="font-bold text-white font-mono">
                      {feedbackData.timeTakenSec.toFixed(1)}s
                    </span>
                  </div>

                  <button
                    onClick={() => setShowFeedbackPopup(false)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-black tracking-wide uppercase cursor-pointer transition-all ${
                      feedbackData.isCorrect
                        ? "bg-teal-400 hover:bg-teal-500 text-black"
                        : "bg-white/10 hover:bg-white/15 text-white"
                    }`}
                  >
                    Got It
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/10 max-w-sm mx-auto">
      <Loader2 className="w-6 h-6 text-teal-400 animate-spin mx-auto mb-2" />
      <span className="text-xs text-white/45">Populating questions slide queue...</span>
    </div>
  );
}

// ---------------- DYNAMIC SCOREBOARD SUBSCRIBER HELPER ----------------
function LeaderboardListener({ quizId }: { quizId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quizId) {
      const pCol = collection(db, "quizzes", quizId, "participants");
      const unsub = onSnapshot(pCol, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as Participant }));
        setParticipants(list);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-white/30 text-xs">
        <Loader2 className="w-4 h-4 animate-spin shrink-0 mr-1.5" />
        <span>Loading live records...</span>
      </div>
    );
  }

  return <LiveLeaderboard participants={participants} />;
}

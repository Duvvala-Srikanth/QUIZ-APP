export interface Quiz {
  id: string;
  hostId: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  createdAt: number;
  status: "Draft" | "Live" | "Completed";
  paused: boolean;
  activeQuestionIndex: number;
  currentQuestionStartTime: number;
  settings: QuizSettings;
}

export interface QuizSettings {
  negativeMarking: boolean;
  negativeMarkFraction: number; // e.g. 0.25 (1/4 marks) or 1.0 (full mark)
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showCorrectAnswersAfterQuiz: boolean;
  allowReview: boolean;
  autoSubmit: boolean;
  fullScreenMode: boolean;
  maxParticipants: number;
  scoringMode?: "fixed" | "dynamic";
  maxPoints?: number;
  minPoints?: number;
  scoringCurve?: "linear" | "exponential";
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  answer: "A" | "B" | "C" | "D";
  marks: number;
  timeLimit: number; // in seconds
  explanation?: string;
  order: number;
  validationErrors?: string[];
}

export interface Participant {
  id: string;
  quizId: string;
  name: string;
  email?: string;
  rollNumber?: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  totalTime?: number; // in seconds
  finalScore?: number;
  accuracy?: number; // percentage of correct / (total - skipped) or correct / total
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  percentage?: number; // score percentage
  status: "Joined" | "In Progress" | "Completed";
  lastActive: number;
  averageResponseTime?: number;
  fastestResponse?: number;
  slowestResponse?: number;
  totalDynamicPoints?: number;
}

export interface ParticipantResponse {
  id: string; // usually `${participantId}_${questionId}`
  quizId: string;
  participantId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D" | null;
  correctOption: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  marksAwarded: number;
  timeTaken: number; // in seconds
  submittedAt: number;
  skipped: boolean;
  visited: boolean;
  responseTimeMs?: number;
  remainingTimeMs?: number;
  maxPoints?: number;
  awardedPoints?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

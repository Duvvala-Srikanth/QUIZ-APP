/**
 * Deeply sanitizes any object or primitive before writing to Firestore.
 * Converts any `undefined` properties to safe non-undefined values as specified by Phase 2:
 * - undefined string -> ""
 * - undefined number -> 0
 * - undefined boolean -> false
 * - undefined array -> []
 * - undefined object -> {}
 * 
 * Also safeguards with general cleanups to avoid "Unsupported field value: undefined" errors.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === undefined) {
    return "" as unknown as T;
  }
  if (obj === null) {
    return null as unknown as T;
  }

  const type = typeof obj;
  if (type === "string" || type === "number" || type === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item)) as unknown as T;
  }

  // Preserve Firestore direct objects (e.g., Timestamps, DocumentRefs, FieldValue)
  if (obj.constructor && ["Timestamp", "DocumentReference", "FieldValue", "GeoPoint"].includes(obj.constructor.name)) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (type === "object") {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val === undefined) {
        // Fallback-map undefined to safe schema defaults
        if (
          key === "email" ||
          key === "rollNumber" ||
          key === "userId" ||
          key === "explanation" ||
          key === "text" ||
          key === "name" ||
          key === "description" ||
          key === "category" ||
          key === "difficulty" ||
          key === "selectedOption" ||
          key === "correctOption"
        ) {
          sanitized[key] = "";
        } else if (key === "scoringMode") {
          sanitized[key] = "fixed";
        } else if (key === "scoringCurve") {
          sanitized[key] = "linear";
        } else if (
          key === "totalTime" ||
          key === "endTime" ||
          key === "finalScore" ||
          key === "accuracy" ||
          key === "correctCount" ||
          key === "wrongCount" ||
          key === "skippedCount" ||
          key === "percentage" ||
          key === "createdAt" ||
          key === "activeQuestionIndex" ||
          key === "currentQuestionStartTime" ||
          key === "timeLimit" ||
          key === "marks" ||
          key === "order" ||
          key === "marksAwarded" ||
          key === "timeTaken" ||
          key === "submittedAt" ||
          key === "lastActive" ||
          key === "startTime" ||
          key === "maxPoints" ||
          key === "minPoints" ||
          key === "responseTimeMs" ||
          key === "remainingTimeMs" ||
          key === "awardedPoints" ||
          key === "averageResponseTime" ||
          key === "fastestResponse" ||
          key === "slowestResponse" ||
          key === "totalDynamicPoints"
        ) {
          sanitized[key] = 0;
        } else if (
          key === "paused" ||
          key === "negativeMarking" ||
          key === "randomizeQuestions" ||
          key === "randomizeOptions" ||
          key === "showCorrectAnswersAfterQuiz" ||
          key === "allowReview" ||
          key === "autoSubmit" ||
          key === "fullScreenMode" ||
          key === "visited" ||
          key === "skipped" ||
          key === "isCorrect"
        ) {
          sanitized[key] = false;
        } else if (key === "options") {
          sanitized[key] = { A: "", B: "", C: "", D: "" };
        } else {
          // General fallback
          sanitized[key] = "";
        }
      } else {
        sanitized[key] = sanitizeFirestoreData(val);
      }
    }
    return sanitized as T;
  }

  return obj;
}

import { Question } from "../types";

/**
 * Parses raw plain-text MCQ input using a robust state machine.
 * This handles single-line and multi-line option declarations perfectly, ensuring no undefined fields.
 * It also returns a list of validation errors per question to assist hosts in refining their content.
 */
export function parseMCQText(text: string, quizId: string): Question[] {
  const questions: Question[] = [];
  const seenTexts = new Set<string>();

  // Split by blocks. We trace boundaries via blank lines or explicit Question/Numbered headings.
  const rawBlocks = text.split(/\n\s*\n\s*(?=Question\s*\d+|^\d+[\.\)]|^Q\d+[:\.])/mi);
  const blocks = rawBlocks.length > 1 ? rawBlocks : text.split(/(?:\r?\n){2,}/);

  let orderCount = 0;

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    const lines = block.split(/\r?\n/).map(l => l.trim());
    if (lines.length === 0) continue;

    const questionLines: string[] = [];
    const optionALines: string[] = [];
    const optionBLines: string[] = [];
    const optionCLines: string[] = [];
    const optionDLines: string[] = [];
    const explanationLines: string[] = [];

    let answerStr = "";
    let marks = 5;
    let timeLimit = 30;
    
    // State machine tracking
    let mode: "question" | "A" | "B" | "C" | "D" | "explanation" | "none" = "question";

    for (let line of lines) {
      if (!line) continue;

      // Handle "Question X:" or "Question:" header triggers
      const questionPrefixMatch = line.match(/^Question\s*\d*\s*[:\.]?\s*(.*)$/i);
      if (questionPrefixMatch) {
        mode = "question";
        const content = questionPrefixMatch[1].trim();
        if (content) questionLines.push(content);
        continue;
      }

      // Check standard options matching (e.g. A. Option text, B) Option, etc.)
      const optionAMatch = line.match(/^A[\.\)\:\s]\s*(.*)$/i);
      if (optionAMatch) {
        mode = "A";
        const content = optionAMatch[1].trim();
        if (content) optionALines.push(content);
        continue;
      }

      const optionBMatch = line.match(/^B[\.\)\:\s]\s*(.*)$/i);
      if (optionBMatch) {
        mode = "B";
        const content = optionBMatch[1].trim();
        if (content) optionBLines.push(content);
        continue;
      }

      const optionCMatch = line.match(/^C[\.\)\:\s]\s*(.*)$/i);
      if (optionCMatch) {
        mode = "C";
        const content = optionCMatch[1].trim();
        if (content) optionCLines.push(content);
        continue;
      }

      const optionDMatch = line.match(/^D[\.\)\:\s]\s*(.*)$/i);
      if (optionDMatch) {
        mode = "D";
        const content = optionDMatch[1].trim();
        if (content) optionDLines.push(content);
        continue;
      }

      // Solitary option labels (e.g., option is on next line)
      if (line === "A" || line === "B" || line === "C" || line === "D") {
        mode = line as "A" | "B" | "C" | "D";
        continue;
      }

      // Match Answer attributes
      const answerMatch = line.match(/^(?:Answer|Correct|Correct Answer|Ans)\s*[:\-=\s]\s*([A-Da-d])/i);
      if (answerMatch) {
        answerStr = answerMatch[1].toUpperCase();
        mode = "none";
        continue;
      }

      // Match Marks attributes
      const marksMatch = line.match(/^(?:Marks|Score|Points)\s*[:\-=\s]\s*(\d+)/i);
      if (marksMatch) {
         marks = parseInt(marksMatch[1], 10) || 5;
         mode = "none";
         continue;
      }

      // Match Time limit attributes
      const timeMatch = line.match(/^(?:Time|Duration|Limit|Secs|Seconds)\s*[:\-=\s]\s*(\d+)/i);
      if (timeMatch) {
        timeLimit = parseInt(timeMatch[1], 10) || 30;
        mode = "none";
        continue;
      }

      // Match Explanation attributes
      const explanationMatch = line.match(/^(?:Explanation|Exp|Reason)\s*[:\-=\s]\s*(.*)$/i);
      if (explanationMatch) {
        mode = "explanation";
        const content = explanationMatch[1].trim();
        if (content) explanationLines.push(content);
        continue;
      }

      // Fallback: append line based on current parser state
      if (mode === "question") {
        // Strip out leading numbering like "1." if it is the very first line of text
        if (questionLines.length === 0) {
          const cleanHeading = line.replace(/^\d+[\.\s]\s*/, "");
          if (cleanHeading) questionLines.push(cleanHeading);
        } else {
          questionLines.push(line);
        }
      } else if (mode === "A") {
        optionALines.push(line);
      } else if (mode === "B") {
        optionBLines.push(line);
      } else if (mode === "C") {
        optionCLines.push(line);
      } else if (mode === "D") {
        optionDLines.push(line);
      } else if (mode === "explanation") {
        explanationLines.push(line);
      } else {
        if (questionLines.length === 0) {
          questionLines.push(line);
          mode = "question";
        }
      }
    }

    const questionText = questionLines.join(" ").trim();
    const optA = optionALines.join(" ").trim();
    const optB = optionBLines.join(" ").trim();
    const optC = optionCLines.join(" ").trim();
    const optD = optionDLines.join(" ").trim();
    const expText = explanationLines.join(" ").trim();

    // If there is literally zero parsed data inside this block, skip it
    if (!questionText && !optA && !optB && !optC && !optD) continue;

    const validationErrors: string[] = [];

    if (!questionText) {
      validationErrors.push("Question text is empty or missing.");
    }
    if (!optA) validationErrors.push("Option A is empty or missing.");
    if (!optB) validationErrors.push("Option B is empty or missing.");
    if (!optC) validationErrors.push("Option C is empty or missing.");
    if (!optD) validationErrors.push("Option D is empty or missing.");

    if (!answerStr) {
      validationErrors.push("Missing correct answer declaration (e.g., 'Answer: A').");
    } else if (!["A", "B", "C", "D"].includes(answerStr)) {
      validationErrors.push(`Answer '${answerStr}' is invalid. Options must be A, B, C, or D.`);
    }

    if (timeLimit <= 0) {
      validationErrors.push("Question time limit must be greater than 0.");
    }
    if (marks < 0) {
      validationErrors.push("Question marks cannot be negative.");
    }

    // Duplicate detection
    if (questionText) {
      const normalized = questionText.toLowerCase().replace(/\s+/g, "");
      if (seenTexts.has(normalized)) {
        validationErrors.push("This question text is a duplicate.");
      } else {
        seenTexts.add(normalized);
      }
    }

    orderCount++;
    
    // Construct question adhering fully to specifications with aliases
    const questionObj: Question & { correctAnswer?: string; questionNumber?: number } = {
      id: Math.random().toString(36).substring(2, 11),
      quizId,
      text: questionText || "(Missing Question Text)",
      options: {
        A: optA || "",
        B: optB || "",
        C: optC || "",
        D: optD || ""
      },
      answer: (["A", "B", "C", "D"].includes(answerStr) ? answerStr : "A") as "A" | "B" | "C" | "D",
      marks,
      timeLimit,
      explanation: expText || "",
      order: orderCount,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      correctAnswer: (["A", "B", "C", "D"].includes(answerStr) ? answerStr : "A"),
      questionNumber: orderCount
    };

    questions.push(questionObj);
  }

  return questions;
}

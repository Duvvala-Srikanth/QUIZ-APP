import React, { useState } from "react";
import { auth } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, Sparkles, AlertCircle, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openSetupHelp, setOpenSetupHelp] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" | null }>({
    text: "",
    type: null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ text: "Please enter both email and password.", type: "error" });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: "Password must be at least 6 characters.", type: "error" });
      return;
    }

    setIsLoading(true);
    setMessage({ text: "", type: null });
    setOpenSetupHelp(false);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage({ text: "Account created successfully! Logging you in...", type: "success" });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage({ text: "Successfully logged in!", type: "success" });
      }
      setTimeout(() => {
        onAuthSuccess();
      }, 1200);
    } catch (err: any) {
      let friendlyMessage = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already in use. Try signing in instead.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        friendlyMessage = "Invalid email or password.";
      } else if (err.code === "auth/operation-not-allowed") {
        friendlyMessage = "Email/Password provider is disabled in the Firebase Console.";
        setOpenSetupHelp(true);
      }
      
      const detailedMessage = err.code 
        ? `${friendlyMessage} (${err.code})` 
        : friendlyMessage;

      setMessage({ text: detailedMessage, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setMessage({ text: "", type: null });
    setOpenSetupHelp(false);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setMessage({ text: "Successfully signed in with Google!", type: "success" });
      setTimeout(() => {
        onAuthSuccess();
      }, 1200);
    } catch (err: any) {
      let friendlyMessage = "Google sign-in was cancelled or failed.";
      if (err.code === "auth/popup-blocked") {
        friendlyMessage = "The login popup was blocked by your browser. Please enable popups/redirects and retry.";
      }
      const detailedMessage = err.code 
        ? `${friendlyMessage} (${err.code})` 
        : friendlyMessage;
      setMessage({ text: detailedMessage, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto relative z-10 p-1">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-purple-500/20 border border-white/15 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isSignUp ? "Create Host Workspace" : "Welcome to Quizzle"}
          </h2>
          <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
            {isSignUp 
              ? "Sign up with your credentials to start organizing with real-time sync" 
              : "Sign in with your email and password to access your persistent quizzes"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/60 tracking-wide font-sans">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-white/30 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 text-white rounded-xl py-2.5 pl-10 pr-4 outline-none transition-all text-sm font-sans placeholder-white/25"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/60 tracking-wide font-sans">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-white/30 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 text-white rounded-xl py-2.5 pl-10 pr-4 outline-none transition-all text-sm font-sans placeholder-white/25"
              />
            </div>
          </div>

          {/* Messages info */}
          <AnimatePresence mode="wait">
            {message.type && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                  message.type === "error" 
                    ? "bg-red-500/15 border-red-500/20 text-red-300" 
                    : "bg-emerald-500/15 border-emerald-500/20 text-emerald-300"
                }`}
              >
                {message.type === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span>{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign In / Sign Up Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-teal-400 hover:bg-teal-300 disabled:bg-teal-500/50 text-black font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-teal-400/10 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer outline-none mt-6"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? "Create Account" : "Enter Creator Console"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* OR divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative px-3 bg-[#0a1120] text-[10px] font-mono uppercase tracking-widest text-white/40 font-bold">
            or continue with
          </span>
        </div>

        {/* Google Sign In option */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-white/5 hover:bg-white/10 active:scale-95 text-white border border-white/10 rounded-xl py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2.5 transition-all outline-none cursor-pointer mb-2"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.56 14.97 1 12 1 7.35 1 3.4 3.65 1.49 7.5l3.85 2.99C6.26 7.42 8.91 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.45h6.44c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.39-4.87 3.39-8.5z"
            />
            <path
              fill="#FBBC05"
              d="M5.34 14.99c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.49 7.42C.54 9.32 0 11.45 0 13.7s.54 4.38 1.49 6.28l3.85-2.99z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.93 1.09-3.09 0-5.74-2.38-6.66-5.45l-3.85 2.99C3.4 20.35 7.35 23 12 23z"
            />
          </svg>
          <span>Sign In with Google</span>
        </button>

        {/* Setup Help Guide Block */}
        <AnimatePresence>
          {openSetupHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 text-xs text-amber-200/90 space-y-3 relative z-10 overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="font-bold text-amber-300">Enable Email Sign-Up in Firebase</h3>
              </div>
              
              <p className="leading-relaxed text-[11px] text-amber-200/80">
                To complete registration using your email & password, please enable the provider in your Firebase developer console:
              </p>

              <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-200/85">
                <li>Click the helper button to open your configuration.</li>
                <li>Click <span className="font-semibold text-white">Add new provider</span> under <span className="font-medium">Sign-in providers</span>.</li>
                <li>Choose <span className="font-semibold text-white">Email/Password</span>, toggle <span className="font-semibold text-white">Enable</span> to ON, and save.</li>
              </ol>

              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                <a
                  href="https://console.firebase.google.com/project/round-transport-b8t0d/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 rounded-xl py-2 px-3 text-[11px] font-semibold transition-all flex items-center justify-center gap-1 border border-amber-500/35 text-center cursor-pointer"
                >
                  <span>Open Console Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2 px-3 text-[11px] font-semibold transition-all border border-white/10 text-center cursor-pointer"
                >
                  Use Google Instead
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-5 border-t border-white/5 text-center relative z-10">
          <p className="text-xs text-white/50">
            {isSignUp ? "Already have an account?" : "Don't have an account yet?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage({ text: "", type: null });
              }}
              className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-4 outline-none cursor-pointer"
            >
              {isSignUp ? "Sign In" : "Sign Up Free"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

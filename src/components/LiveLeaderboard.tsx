import React from "react";
import { Participant } from "../types";
import { Trophy, Medal, Award, Flame, ThumbsUp, Percent, Hourglass } from "lucide-react";

interface LiveLeaderboardProps {
  participants: Participant[];
}

export default function LiveLeaderboard({ participants }: LiveLeaderboardProps) {
  // Sort participants by score descending. If tied, sort by accuracy, then totalTime ascending
  const sorted = [...participants]
    .filter(p => p.status === "Completed" || p.status === "In Progress")
    .sort((a, b) => {
      const scoreDiff = (b.finalScore || 0) - (a.finalScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      
      const accDiff = (b.accuracy || 0) - (a.accuracy || 0);
      if (accDiff !== 0) return accDiff;
      
      return (a.totalTime || 0) - (b.totalTime || 0);
    });

  const top3 = sorted.slice(0, 3);
  const remaining = sorted.slice(3);

  // Helper to render rank icons/badges
  const renderRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="relative flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
            </span>
          </div>
        );
      case 1:
        return <Medal className="w-6 h-6 text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.4)]" />;
      case 2:
        return <Award className="w-6 h-6 text-amber-600 drop-shadow-[0_0_8px_rgba(180,83,9,0.4)]" />;
      default:
        return (
          <span className="text-xs font-mono font-black text-white/40 bg-white/5 px-2.5 py-1 rounded-md">
            #{index + 1}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Podiums Header */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="relative order-2 md:order-1 flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-5 text-center backdrop-blur-md shadow-lg overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gray-400" />
              <div className="mb-3 p-2 bg-gray-400/10 rounded-full text-gray-300">
                <Medal className="w-8 h-8" />
              </div>
              <p className="font-bold text-white text-sm tracking-tight truncate max-w-full">
                {top3[1].name}
              </p>
              {top3[1].rollNumber && (
                <p className="text-[10px] font-mono text-white/40 mt-0.5">Roll: {top3[1].rollNumber}</p>
              )}
              <div className="mt-4 space-y-1.5 w-full">
                <div className="text-xl font-black text-white">{top3[1].finalScore || 0} pts</div>
                <div className="flex items-center justify-center gap-3 text-[10px] text-white/50 font-mono">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    {top3[1].correctCount || 0}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Percent className="w-3 h-3 text-teal-400 shrink-0" />
                    {Math.round(top3[1].accuracy || 0)}%
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Hourglass className="w-3 h-3 text-sky-400 shrink-0" />
                    {top3[1].totalTime || 0}s
                  </span>
                </div>
              </div>
              <span className="absolute bottom-1 right-2 text-3xl font-mono font-black text-white/3">2</span>
            </div>
          )}

          {/* 1st Place (Winner) */}
          {top3[0] && (
            <div className="relative order-1 md:order-2 flex flex-col items-center bg-yellow-400/5 border-2 border-yellow-400/20 rounded-2xl p-6 text-center backdrop-blur-md shadow-2xl overflow-hidden scale-105 z-10">
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400" />
              <div className="mb-3 p-3 bg-yellow-400/10 rounded-full text-yellow-400 relative">
                <Trophy className="w-10 h-10 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
                <Flame className="w-4 h-4 text-orange-500 absolute top-2 right-2 animate-bounce" />
              </div>
              <p className="font-black text-white text-base tracking-tight truncate max-w-full">
                {top3[0].name}
              </p>
              {top3[0].rollNumber && (
                <p className="text-[10px] font-mono text-yellow-400/50 mt-0.5">Roll: {top3[0].rollNumber}</p>
              )}
              <div className="mt-4 space-y-1.5 w-full">
                <div className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.3)]">
                  {top3[0].finalScore || 0} pts
                </div>
                <div className="flex items-center justify-center gap-3 text-[10px] text-white/60 font-mono">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    {top3[0].correctCount || 0}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Percent className="w-3 h-3 text-teal-400 shrink-0" />
                    {Math.round(top3[0].accuracy || 0)}%
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Hourglass className="w-3 h-3 text-sky-400 shrink-0" />
                    {top3[0].totalTime || 0}s
                  </span>
                </div>
              </div>
              <span className="absolute bottom-1 right-2 text-4xl font-mono font-black text-white/5">1</span>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="relative order-3 md:order-3 flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-5 text-center backdrop-blur-md shadow-lg overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-amber-600" />
              <div className="mb-3 p-2 bg-amber-600/10 rounded-full text-amber-600">
                <Award className="w-8 h-8" />
              </div>
              <p className="font-bold text-white text-sm tracking-tight truncate max-w-full">
                {top3[2].name}
              </p>
              {top3[2].rollNumber && (
                <p className="text-[10px] font-mono text-white/40 mt-0.5">Roll: {top3[2].rollNumber}</p>
              )}
              <div className="mt-4 space-y-1.5 w-full">
                <div className="text-xl font-black text-white">{top3[2].finalScore || 0} pts</div>
                <div className="flex items-center justify-center gap-3 text-[10px] text-white/50 font-mono">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    {top3[2].correctCount || 0}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Percent className="w-3 h-3 text-teal-400 shrink-0" />
                    {Math.round(top3[2].accuracy || 0)}%
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Hourglass className="w-3 h-3 text-sky-400 shrink-0" />
                    {top3[2].totalTime || 0}s
                  </span>
                </div>
              </div>
              <span className="absolute bottom-1 right-2 text-3xl font-mono font-black text-white/3">3</span>
            </div>
          )}
        </div>
      )}

      {/* Main Leaderboard Runner-up List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
        <div className="px-5 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold">
          <span>Rank & Name</span>
          <div className="flex items-center gap-10 md:gap-14">
            <span className="w-12 text-center">Correct</span>
            <span className="w-12 text-center">Accuracy</span>
            <span className="w-16 text-right">Score</span>
          </div>
        </div>

        <div className="divide-y divide-white/5 max-h-[350px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-xs text-white/30 font-medium">
              No participant scores submitted yet
            </div>
          ) : (
            sorted.map((participant, index) => {
              const isTop3 = index < 3;
              return (
                <div
                  key={participant.id}
                  className={`px-5 py-3.5 flex items-center justify-between transition-colors ${
                    isTop3 ? "bg-white/[0.01]" : "hover:bg-white/5"
                  }`}
                >
                  {/* Left rank and name info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-8 flex items-center justify-center font-mono">
                      {renderRankBadge(index)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {participant.name}
                        </span>
                        {participant.status === "In Progress" && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-yellow-400/10 text-yellow-400 text-[8px] font-bold uppercase tracking-wider">
                            Live
                          </span>
                        )}
                      </div>
                      {(participant.rollNumber || participant.email) && (
                        <span className="text-[10px] text-white/40 block leading-tight font-mono truncate max-w-[200px]">
                          {participant.rollNumber ? `Roll: ${participant.rollNumber}` : ""}
                          {participant.rollNumber && participant.email ? " · " : ""}
                          {participant.email ? participant.email : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Right */}
                  <div className="flex items-center gap-10 md:gap-14 font-mono">
                    <span className="w-12 text-center text-xs text-white/60 font-medium">
                      {participant.correctCount || 0}
                    </span>
                    <span className="w-12 text-center text-xs text-teal-400 font-semibold">
                      {Math.round(participant.accuracy || 0)}%
                    </span>
                    <span className="w-16 text-right text-xs font-black text-white">
                      {participant.finalScore || 0}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

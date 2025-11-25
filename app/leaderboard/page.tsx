"use client";

import React, { useEffect, useState } from "react";

type Entry = {
  id: string;
  name: string;
  score: number;
  color?: string;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const json = await res.json();
        setEntries(json.leaderboard || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-[#064e3b] to-slate-900 text-white">
      <div className="max-w-3xl w-full">
        <h1 className="text-4xl font-extrabold mb-6">The Leaderboard</h1>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          {loading ? (
            <p className="text-slate-300">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-slate-400">No scores recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {entries.map((e, i) => (
                <li
                  key={e.id}
                  className={`flex items-center justify-between p-3 rounded-md ${
                    i === 0 ? "bg-yellow-600/20" : "bg-white/2"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: e.color || "#888" }}
                    />
                    <div>
                      <div className="font-semibold">{e.name}</div>
                      <div className="text-xs text-slate-400">#{i + 1}</div>
                    </div>
                  </div>
                  <div className="font-mono text-lg">{e.score}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

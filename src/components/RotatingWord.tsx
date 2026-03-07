"use client";

import { useState, useEffect } from "react";

const WORDS = ["Remove", "Resize", "Recolor", "Detect"];
const COLORS = ["#F43F5E", "#10B981", "#F59E0B", "#0EA5E9"];
const INTERVAL_MS = 3000;

export function RotatingWord() {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
      setAnimKey((prev) => prev + 1);
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      key={animKey}
      className="rotating-word"
      style={{ color: COLORS[index] }}
    >
      {WORDS[index]}
    </span>
  );
}

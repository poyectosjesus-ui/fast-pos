"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function DigitalClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span className="text-[11px] font-black tabular-nums tracking-widest leading-none">
        {time || "00:00:00"}
      </span>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  /** 活动结束时间 */
  endDate: string | Date;
  /** 前置标签，如 "距离活动结束" */
  label?: string;
  /** 活动过期后的回调 */
  onExpire?: () => void;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(end: Date): TimeLeft | null {
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * 活动倒计时组件
 *
 * 纯客户端 1s 刷新，显示天/时/分/秒差值。
 * 活动结束后显示 "活动已结束" 并调起 onExpire 回调。
 */
export function CountdownTimer({ endDate, label, onExpire, className = "" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => {
    return calcTimeLeft(new Date(endDate));
  });

  const hasCalledExpire = useRef(false);
  const endDateRef = useRef(endDate);

  useEffect(() => {
    endDateRef.current = endDate;
    hasCalledExpire.current = false;
    setTimeLeft(calcTimeLeft(new Date(endDate)));
  }, [endDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      const left = calcTimeLeft(new Date(endDateRef.current));
      setTimeLeft(left);
      if (!left && !hasCalledExpire.current) {
        hasCalledExpire.current = true;
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpire]);

  // 已过期
  if (!timeLeft) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[12px] text-brand-charcoal/60 ${className}`}>
        <Clock className="w-3.5 h-3.5" />
        活动已结束
      </span>
    );
  }

  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}天`);
  parts.push(`${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`);

  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] text-brand-charcoal/70 ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      {label && <span>{label}</span>}
      <span className="font-mono font-medium tabular-nums">{parts.join(" ")}</span>
    </span>
  );
}

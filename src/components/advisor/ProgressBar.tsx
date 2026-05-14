"use client";

import { m } from "framer-motion";

interface ProgressBarProps {
  current: number;
  total: number;
  /** 是否显示百分比（移动端可隐藏） */
  showPercentage?: boolean;
  /** 是否使用紧凑模式（仅显示进度条） */
  compact?: boolean;
}

/**
 * 进度条组件 - 极简数字风格
 */
export function ProgressBar({
  current,
  total,
  compact = false,
}: ProgressBarProps) {
  // 紧凑模式：极简细线
  if (compact) {
    const progress = (current / total) * 100;
    return (
      <div className="w-full h-[2px] bg-[#E5E5E5] rounded-full overflow-hidden">
        <m.div
          className="h-full bg-[#4A3728] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    );
  }

  // 常规模式：纯数字指示器
  return (
    <div className="w-full flex justify-center py-6">
      <div className="flex items-baseline gap-1">
        <span className="font-serif text-xl font-medium text-[#1A1A1A]">
          {String(current).padStart(2, '0')}
        </span>
        <span className="text-xs font-light text-[#5E5E5E]/40">
          / {String(total).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}


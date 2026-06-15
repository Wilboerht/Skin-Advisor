"use client";

import { useState } from "react";
import { Share2, MessageCircle, Instagram, Link2, Check } from "lucide-react";
import type { M10Data } from "@/lib/result-content";

interface ShareButtonsProps {
  m10: M10Data;
  url?: string;
}

export default function ShareButtons({ m10, url = typeof window !== "undefined" ? window.location.href : "" }: ShareButtonsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const xhsText = [m10.xiaohongshu, m10.hashtags.map((t) => `#${t}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");

  const wechatText = m10.wechat;

  const shareItems = [
    {
      label: "小红书文案",
      icon: Instagram,
      text: xhsText,
      color: "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200",
    },
    {
      label: "朋友圈文案",
      icon: MessageCircle,
      text: wechatText,
      color: "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200",
    },
    {
      label: "复制链接",
      icon: Link2,
      text: url,
      color: "hover:bg-stone-50 hover:text-stone-600 hover:border-stone-200",
    },
  ];

  return (
    <section className="py-16 md:py-24 px-6 bg-[#F5F2ED]">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-[#8A8A8A] mb-3">Share</p>
        <h2 className="text-2xl md:text-3xl font-light text-[#1A1A1A] tracking-tight mb-10">
          分享你的肌肤诊断
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {shareItems.map((item) => {
            const Icon = item.icon;
            const isCopied = copied === item.label;
            return (
              <button
                key={item.label}
                onClick={() => handleCopy(item.text, item.label)}
                className={`
                  group flex items-center gap-2 px-6 py-3 rounded-full border border-[#D9D0C3]
                  bg-white text-[#4A4A4A] transition-all duration-300
                  ${item.color}
                `}
              >
                {isCopied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                )}
                <span className="text-sm font-medium tracking-wide">
                  {isCopied ? "已复制" : item.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-8 text-sm text-[#8A8A8A] leading-relaxed">
          每一次分享，都是一次与肌肤对话的延续。
        </p>
      </div>
    </section>
  );
}

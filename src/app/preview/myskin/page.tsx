"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * /preview/myskin — myskin.org 风格复刻演示页
 * 仅供风格评审：配色/字形/叠拱版式对齐 myskin.org，内容为肌智派适配文案。
 * 关键映射：
 *  - 奶油底 #F4F4E8 · 金 #A99A83 · 米金 #E0E1CE · 鼠尾草 #D1D3C2 · 墨绿 #3F8978
 *  - 巨型半圆拱分区（rounded-[100rem]）+ 负 margin 叠拱
 *  - BiancoSerif 氛围以系统衬线（Georgia / 宋体）近似（CSP font-src 'self'，不引外部字体）
 */

const GOLD = "#A99A83";
const CREAM = "#F4F4E8";
const PSOGREEN = "#3F8978";
const DARK = "#2A2623";

const SERIF = "'Georgia','Songti SC','Noto Serif SC',serif";

const FAQ_ITEMS = [
  {
    q: "测肤需要多长时间？",
    a: "全程约 3 分钟：先完成一份简短的皮肤问卷（约 1 分钟），再进行 AI 面部扫描（约 2 分钟）。扫描过程有清晰的引导提示。",
  },
  {
    q: "我的照片和数据安全吗？",
    a: "面部分析在完成后即被删除，测肤数据加密存储。隐私政策遵循最小留存原则，游客数据保留 90 天，登录后档案可由你随时查看。",
  },
  {
    q: "未登录可以保存记录吗？",
    a: "游客可完整体验测肤流程并查看本次结果；登录后系统会自动同步你的测肤趋势、里程碑与每日打卡记录。",
  },
];

export default function MyskinPreviewPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1280px] mx-auto bg-[#F4F4E8] min-h-screen">
        {/* ===== Navbar (fixed-top 风格) ===== */}
        <nav className="fixed top-0 inset-x-0 z-50 bg-[#F4F4E8]/95 backdrop-blur-sm border-b border-[#A99A83]/15">
          <div className="max-w-[1280px] mx-auto px-4 md:px-8 h-[50px] flex items-center justify-between">
            <a href="#home" className="text-[22px] leading-none" style={{ fontFamily: SERIF, color: GOLD, fontWeight: 700 }}>
              肌智派<span style={{ color: PSOGREEN }}>.</span>
            </a>

            {/* 移动端独立 CTA（d-lg-none 模拟） */}
            <div className="flex items-center gap-2 lg:hidden">
              <Link href="/questions" className="inline-flex items-center gap-1 bg-[#3F8978] text-white text-[13px] px-3 h-9 rounded-full hover:bg-[#356e60] transition-colors">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M15 8a7 7 0 1 0-14 0 7 7 0 0 0 14 0ZM8.5 5.5a.5.5 0 1 0-1 0v2h-2a.5.5 0 1 0 0 1h2v2a.5.5 0 1 0 1 0v-2h2a.5.5 0 1 0 0-1h-2v-2Z"/></svg>
                开始测肤
              </Link>
            </div>

            {/* 桌面菜单 */}
            <ul className="hidden lg:flex items-center gap-6 text-[14px] text-[#2A2623]/80">
              <li><a href="#home" className="hover:text-[#3F8978] transition-colors">首页</a></li>
              <li><a href="#questions" className="hover:text-[#3F8978] transition-colors">常见问题</a></li>
              <li>
                <Link href="/questions" className="inline-flex items-center gap-1.5 bg-[#3F8978] text-white px-4 h-9.5 py-2 rounded-full hover:bg-[#356e60] transition-colors">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M15 8a7 7 0 1 0-14 0 7 7 0 0 0 14 0ZM8.5 5.5a.5.5 0 1 0-1 0v2h-2a.5.5 0 1 0 0 1h2v2a.5.5 0 1 0 1 0v-2h2a.5.5 0 1 0 0-1h-2v-2Z"/></svg>
                  开始测肤
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="pt-[50px]">
          {/* ===== Hero 半圆拱（金 Cream）===== */}
          <section
            id="home"
            className="flex items-start justify-center rounded-b-[100rem] bg-[#E0E1CE] min-h-[100vh] pt-[18vh] pb-[38vh] px-6 text-center md:text-left"
          >
            <h1
              className="text-[36px] md:text-[48px] leading-[1.25] w-[70%] md:w-[60%]"
              style={{ fontFamily: SERIF, color: GOLD }}
            >
              <span className="font-bold">肌智派</span>
              {" "}— 由 AI 护肤顾问与皮肤科学研究者
              共同打造的测肤档案体系。
            </h1>
          </section>

          {/* ===== Body1 反向半圆拱（鼠尾草）===== */}
          <section className="relative z-10 -mt-[28vh] rounded-t-[100rem] bg-[#D1D3C2] min-h-[110vh] pt-[38vh] pb-[12vh] px-6">
            <div className="max-w-[70%] mx-auto flex md:flex-row flex-col gap-10">
              {/* 左：墨绿衬线引导词 */}
              <div className="md:w-1/2 mb-10 md:mb-0">
                <h2
                  className="text-[24px] md:text-[28px] leading-[1.35]"
                  style={{ fontFamily: SERIF, color: PSOGREEN }}
                >
                  我们致力于理解肌肤如何随时间变化，以及为什么会变化。加入肌智派，让每一次测肤都成为可追溯的肌肤档案。
                </h2>
              </div>

              {/* 右：正文 + CTA */}
              <div className="md:w-1/2 text-[#2A2623] text-[15px] md:text-[16px] leading-relaxed space-y-4">
                <p>
                  <b>每次测肤后，系统自动生成肌肤档案</b>：综合评分趋势、肌肤状态里程碑、每日打卡记录——无需手动整理，见证肌肤的真实变化。
                </p>
                <p>
                  我们关注你的肌肤与身体健康的复杂关系。这份认知将帮助你理解长期护肤规律，让每一个护肤决策都更从容。
                </p>
                <div className="flex justify-center py-4">
                  <Link
                    href="/questions"
                    className="inline-flex items-center gap-2 bg-[#3F8978] text-white px-6 h-11 rounded-full text-[16px] hover:bg-[#356e60] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M1 8a7 7 0 1 4 6.3v.7a.5.5 0 0 1-1 0v-1.55A7 7 0 1 1 1 8Zm8-1.5a.5.5 0 1 0-1 0v3a.5.5 0 1 0 1 0v-3ZM5.38 2.62a.5.5 0 1 0-.76.65l1.35 1.57a.5.5 0 0 0 .76-.65L5.38 2.62Zm6.26.65a.5.5 0 1 0-.76-.65L9.53 4.19a.5.5 0 1 0 .76.65l1.35-1.57Z"/></svg>
                    开始测肤
                  </Link>
                </div>
                <p className="text-center text-[13px] opacity-70">任何时间都可以开始测肤，无需登录。</p>
              </div>
            </div>
          </section>

          {/* ===== Body2 墨绿拱（感谢区）===== */}
          <section className="relative z-10 -mt-[18vh]">
            <div className="w-[60%] mx-auto rounded-b-[30rem] bg-[#3F8978] min-h-[60vh] pt-[10vh] pb-[12vh] px-8 flex items-start justify-between gap-6">
              <div className="max-w-[55%]">
                <h2
                  className="text-[24px] md:text-[28px] leading-[1.4]"
                  style={{ fontFamily: SERIF, color: CREAM }}
                >
                  通过测肤与打卡，你不仅在看肌肤的变化——也在帮助更多人理解皮肤科学的真相。
                </h2>
              </div>
              <div className="text-[#E0E1CE] shrink-0 pt-4">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.9">
                  <path d="M12 3c1.8 2.2 3.4 2.6 5.4 2.4.2 2 .8 4 3 5.6-2.2 1.6-2.8 3.6-3 5.6-2-.2-3.6.2-5.4 2.4-1.8-2.2-3.4-2.6-5.4-2.4-.2-2-.8-4-3-5.6 2.2-1.6 2.8-3.6 3-5.6 2 .2 3.6-.2 5.4-2.4Z" />
                  <path d="M18.5 15.5c.4 1.6 1 2.6 2.5 3.5-1.5.9-2.1 1.9-2.5 3.5-.4-1.6-1-2.6-2.5-3.5 1.5-.9 2.1-1.9 2.5-3.5Z" strokeOpacity="0.6" />
                </svg>
              </div>
            </div>
          </section>

          {/* ===== Questions 手风琴（Bootstrap flush 风格）===== */}
          <section id="questions" className="pt-24 pb-16 px-6">
            <div className="max-w-[70%] mx-auto">
              <h1
                className="text-[28px] md:text-[40px] leading-[1.2] mb-10"
                style={{ fontFamily: SERIF, color: GOLD }}
              >
                <b>常见问题</b> 如果你对测肤、数据或档案体系还有疑问，欢迎在这里找到答案。
              </h1>

              <div className="border-t border-[#A99A83]/25">
                {FAQ_ITEMS.map((item, i) => {
                  const isOpen = open === i;
                  return (
                    <div key={i} className="border-b border-[#A99A83]/25">
                      <button
                        onClick={() => setOpen(isOpen ? null : i)}
                        className="w-full flex items-center justify-between py-4 text-left text-[18px] md:text-[20px] text-[#2A2623] hover:text-[#3F8978] transition-colors"
                      >
                        <span>{item.q}</span>
                        <span
                          className={`text-[#A99A83] text-[26px] leading-none transform transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                        >
                          +
                        </span>
                      </button>
                      <div
                        className={`overflow-hidden transition-[max-height] duration-300 ${isOpen ? "max-h-64" : "max-h-0"}`}
                      >
                        <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[#2A2623]/75">{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ===== Footer 演示标注 ===== */}
          <footer className="py-8 text-center text-[13px]">
            <p style={{ color: DARK }} className="opacity-60">
              肌智派 · <span className="opacity-80">myskin.org 风格复刻演示</span>
              <span className="mx-2">·</span>
              <Link href="/diary" className="underline hover:text-[#3F8978]">返回肌智派 →</Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

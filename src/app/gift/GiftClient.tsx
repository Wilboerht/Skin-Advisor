"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import { CountdownTimer } from "@/components/advisor/CountdownTimer";

interface CampaignData {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImage: string | null;
  startDate: string;
  endDate: string;
  drawDate: string | null;
  prizes: Array<{ name: string; image: string; quantity: number; description?: string }>;
  shareText: string | null;
  rules: string | null;
}

type PageState = "no_campaign" | "show_campaign" | "error";

export default function GiftClient({ serverCampaign }: { serverCampaign: CampaignData | null }) {
  const [campaign, setCampaign] = useState<CampaignData | null>(serverCampaign);
  const [fetchFailed, setFetchFailed] = useState(false);

  // SSR 没拿到数据时客户端兜底请求，直接渲染接口数据（不再 reload，
  // 避免 ISR 300s 缓存期内返回旧页导致无限刷新循环）
  useEffect(() => {
    if (serverCampaign) return;
    let cancelled = false;
    fetch("/api/campaign")
      .then((res) => res.json())
      .then((data: { campaign?: CampaignData | null }) => {
        if (cancelled) return;
        if (data.campaign) {
          setCampaign(data.campaign);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [serverCampaign]);

  const pageState: PageState = fetchFailed
    ? "error"
    : campaign
      ? "show_campaign"
      : "no_campaign";

  // 活动是否已开始：挪到客户端 effect 计算，避免 ISR 页面 SSR 与水合时当前时间不一致
  const [campaignStarted, setCampaignStarted] = useState(false);
  useEffect(() => {
    setCampaignStarted(!!campaign && new Date() >= new Date(campaign.startDate));
  }, [campaign]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <main className="relative min-h-dvh flex flex-col text-brand-charcoal bg-[#FDFBF7] overflow-hidden">
      <WebsiteNavbar />

      <div className="flex-1">
        {/* Hero */}
        <section className="relative pt-24 md:pt-40 pb-18 px-6 md:px-12 lg:px-20">
          <div className="relative z-10 max-w-5xl mx-auto text-center">
            <h1 className="text-xl md:text-3xl font-serif font-light text-brand-charcoal leading-[1.1] tracking-[0.02em] mb-5 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
              肌智派送好礼
            </h1>

            {/* 状态信息 */}
            <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
              {pageState === "no_campaign" && (
                <div className="inline-flex items-center gap-2 text-sm text-brand-charcoal/60">
                  <Sparkles className="w-4 h-4 text-brand-charcoal/70" />
                  <span>下一期活动筹备中，敬请期待</span>
                </div>
              )}

              {pageState === "error" && (
                <div className="inline-flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  加载未成功，请刷新页面重试
                </div>
              )}

              {pageState === "show_campaign" && campaign && (
                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
                  {campaign.drawDate && (
                    <div className={`flex items-center gap-2 ${campaignStarted ? "text-xs" : "text-sm"} text-brand-charcoal/60`}>
                      <Sparkles className="w-4 h-4 text-brand-charcoal/70" />
                      <span>开奖时间：{formatDate(campaign.drawDate)}</span>
                    </div>
                  )}

                  {/* 活动倒计时 */}
                  <CountdownTimer
                    endDate={campaign.endDate}
                    label="距离活动结束"
                  />
                </div>
              )}
              </div>
            </div>
          </section>

        {/* 无活动 - 玩法预告 */}
        {pageState === "no_campaign" && (
          <section className="relative z-10 pb-12 md:pb-16 px-6 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto">
              <div className="max-w-4xl mx-auto mb-12 md:mb-16">
                {/* 顶部形象图 */}
                <div className="flex justify-center mb-12 md:mb-16">
                  <Image
                    src="/images/gift-badge.png"
                    alt="肌智派送好礼"
                    width={200}
                    height={150}
                    className="w-72 md:w-80 h-auto object-contain"
                    unoptimized
                  />
                </div>

                {/* 步骤列表，编号左、文字右 */}
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-xl">
                    {[
                      { step: "01", title: "完成测肤或护肤习惯问卷", desc: "获取您的肌智派测肤结果及所属派系形象海报" },
                      { step: "02", title: "分享小红书", desc: "发布海报并 @NIHPLOD" },
                      { step: "03", title: "查看好礼", desc: "浏览活动奖品详情与活动规则" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 md:gap-6">
                        <div className="flex flex-col items-center self-stretch">
                          <span className="shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-transparent border border-brand-charcoal/60 flex items-center justify-center text-sm md:text-base font-medium text-brand-charcoal">
                            {parseInt(item.step)}
                          </span>
                          {i < 2 && <div className="w-px flex-1 bg-brand-charcoal/15 my-2" />}
                        </div>
                        <div className={`flex-1 ${i < 2 ? "pb-8 md:pb-10" : ""}`}>
                          <h3 className="text-sm md:text-base font-light text-brand-charcoal tracking-[0.06em] mb-1">{item.title}</h3>
                          <p className="text-[13px] md:text-sm text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
                <Link
                  href="/"
                  className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none"
                >
                  <span>前往测试，看看你的肌肤形象</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                </Link>
                <Link
                  href="/skin-types"
                  className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer text-brand-charcoal/60 transition-colors duration-500 hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal"
                >
                  <span>查看全部肌智派类型</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* 错误状态 */}
        {pageState === "error" && (
          <section className="relative z-10 pb-12 md:pb-16 px-6 md:px-12 lg:px-20">
            <div className="max-w-md mx-auto text-center">
              <div className="rounded-2xl border border-brand-charcoal/[0.08] bg-[#FAF9F6] p-5 md:p-9">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">活动信息加载未成功</h2>
                <p className="text-sm text-brand-charcoal/60 font-light mb-6">请检查网络连接后刷新页面，或稍后再试。</p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-3 px-8 py-4 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none"
                >
                  <Loader2 className="w-4 h-4" />
                  <span>重新加载</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 奖品展示 */}
        {pageState === "show_campaign" && campaign && (
          <section className="relative z-10 pb-12 md:pb-16 px-6 md:px-12 lg:px-20">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-2xl border border-brand-charcoal/[0.12] p-6 md:p-8 relative">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-block px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-brand-charcoal bg-white rounded-full border border-brand-charcoal/20 whitespace-nowrap">
                    本期好礼
                  </span>
                </div>
                <div className="flex flex-col md:grid md:grid-cols-3 gap-4 md:gap-6 place-items-start text-center mt-4">
                  {Array.isArray(campaign.prizes) && campaign.prizes.map((prize, i) => (
                    <div key={i} className="flex flex-row md:flex-col items-center w-full gap-3 md:gap-0">
                      <div className="relative w-[56px] h-[56px] md:w-full md:aspect-square md:max-w-[80px] p-2 md:p-3 flex items-center justify-center mb-0 md:mb-3 shrink-0">
                        {prize.image ? (
                          <Image
                            src={prize.image}
                            alt={prize.name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <Gift className="w-8 h-8 text-brand-charcoal/20" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13px] font-medium text-brand-charcoal mb-0.5 leading-tight">{prize.name}</h3>
                        {prize.description && (
                          <p className="text-[13px] text-brand-charcoal/60 font-light leading-relaxed">{prize.description}</p>
                        )}
                      </div>
                      <p className="text-[13px] text-brand-charcoal/60 shrink-0">×{prize.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 活动规则 */}
        {pageState === "show_campaign" && campaign && (
          <section className="relative z-10 pb-12 md:pb-16 px-6 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto">
              <div className="max-w-4xl mx-auto mb-12 md:mb-16">
                {/* 顶部形象图 */}
                <div className="flex justify-center mb-12 md:mb-16">
                  <Image
                    src="/images/gift-badge.png"
                    alt="肌智派送好礼"
                    width={200}
                    height={150}
                    className="w-72 md:w-80 h-auto object-contain"
                    unoptimized
                  />
                </div>

                {/* 步骤列表，编号左、文字右 */}
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-xl">
                    {[
                      { step: "01", title: "生成专属海报", desc: "点击下方按钮，生成您的专属活动海报与小红书分享文案。" },
                      { step: "02", title: "分享到小红书", desc: "将海报发布到您的小红书账号，附上活动文案并 @NIHPLOD" },
                      { step: "03", title: "查看好礼", desc: `浏览活动奖品详情${campaign.drawDate ? `（活动时间：${formatDate(campaign.drawDate)}）` : ""}。` },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 md:gap-6">
                        <div className="flex flex-col items-center self-stretch">
                          <span className="shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-transparent border border-brand-charcoal/60 flex items-center justify-center text-sm md:text-base font-medium text-brand-charcoal">
                            {parseInt(item.step)}
                          </span>
                          {i < 2 && <div className="w-px flex-1 bg-brand-charcoal/15 my-2" />}
                        </div>
                        <div className={`flex-1 ${i < 2 ? "pb-8 md:pb-10" : ""}`}>
                          <h3 className="text-sm md:text-base font-light text-brand-charcoal tracking-[0.06em] mb-1">{item.title}</h3>
                          <p className="text-[13px] md:text-sm text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em]">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
                <Link
                  href="/"
                  className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none"
                >
                  <span>前往测试，看看你的肌肤形象</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                </Link>
                <Link
                  href="/skin-types"
                  className="w-full group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer text-brand-charcoal/60 transition-colors duration-500 hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal"
                >
                  <span>查看全部肌智派类型</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                </Link>
              </div>
            </div>
          </section>
        )}

      </div>

      <footer className="relative z-10 pt-4 md:pt-8 pb-[calc(1rem+env(safe-area-inset-bottom,16px))] md:pb-[calc(2rem+env(safe-area-inset-bottom,16px))] px-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[11px] font-light text-brand-charcoal/[0.48]">
          <p className="tracking-[0.1em] md:tracking-[0.15em]">© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-brand-charcoal/20">·</span>
          <div className="hidden sm:flex items-center gap-3 tracking-[0.12em]">
            <Link href="https://nihplod.cn/privacy" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              隐私政策
            </Link>
            <span className="text-brand-charcoal/20">·</span>
            <Link href="https://nihplod.cn/terms" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              服务条款
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

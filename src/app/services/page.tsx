import type { Metadata } from "next";
import Image from "next/image";
import { MapPin, MessageCircle, Video, Phone, ArrowRight } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

export const metadata: Metadata = {
  title: "更多服务 | NIHPLOD",
  description: "预约 NIHPLOD 专属护肤顾问，获取一对一面部肌肤分析解读与绝佳护肤体验。",
};

const stores = [
  {
    city: "上海",
    name: "NIHPLOD 上海恒隆广场店",
    address: "上海市静安区南京西路 1266 号恒隆广场 B1-108",
    hours: "10:00 - 22:00",
  },
  {
    city: "上海",
    name: "NIHPLOD 上海国金中心店",
    address: "上海市浦东新区陆家嘴世纪大道 8 号国金中心 LG1-18",
    hours: "10:00 - 22:00",
  },
  {
    city: "北京",
    name: "NIHPLOD 北京 SKP 店",
    address: "北京市朝阳区建国路 87 号 SKP 一层化妆品区",
    hours: "10:00 - 22:00",
  },
  {
    city: "北京",
    name: "NIHPLOD 北京国贸商城店",
    address: "北京市朝阳区建国路 88 号国贸商城南区 B1",
    hours: "10:00 - 21:30",
  },
  {
    city: "杭州",
    name: "NIHPLOD 杭州万象城店",
    address: "杭州市上城区富春路 701 号万象城 B1-112",
    hours: "10:00 - 22:00",
  },
  {
    city: "成都",
    name: "NIHPLOD 成都 IFS 店",
    address: "成都市锦江区红星路三段 1 号 IFS 国际金融中心 L2-08",
    hours: "10:00 - 22:00",
  },
];

const partnerStores = [
  {
    city: "深圳",
    name: "深圳湾万象城 · 旎柏专柜",
    address: "深圳市南山区科苑南路 2888 号深圳湾万象城 B1",
  },
  {
    city: "广州",
    name: "广州太古汇 · 旎柏体验点",
    address: "广州市天河区天河路 383 号太古汇 MU层",
  },
  {
    city: "南京",
    name: "南京德基广场 · 旎柏专柜",
    address: "南京市玄武区中山路 18 号德基广场二期 B1",
  },
];

export default function ServicesPage() {
  return (
    <main className="relative min-h-screen text-[#1A1A1A]">
      <WebsiteNavbar />

      {/* Hero */}
      <section className="relative pt-44 pb-20 md:pt-60 md:pb-28 px-6 md:px-12 lg:px-20 overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p
            className="text-xs uppercase tracking-[0.3em] text-[#8B7355] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            NIHPLOD Services
          </p>
          <h1
            className="text-4xl md:text-6xl font-serif text-[#1A1A1A] font-normal tracking-tight mb-7 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
          >
            更多服务
          </h1>
          <p
            className="text-base md:text-lg text-[#5E5E5E] font-light max-w-2xl mx-auto leading-relaxed opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            无论您选择走进线下门店、预约线上顾问，还是扫码直接联系，
            <br className="hidden md:block" />
            我们都将为您提供一对一的专属面部分析解读，开启臻奢护肤体验。
          </p>
        </div>
      </section>

      {/* 顾问联系 */}
      <section className="pb-16 md:pb-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-center rounded-2xl border border-[rgba(61,68,48,0.1)] bg-white/55 backdrop-blur-md p-8 md:p-12 lg:p-16">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#8B7355] mb-4">
                专属顾问
              </p>
              <h2 className="text-3xl md:text-4xl font-serif text-[#1A1A1A] mb-5 leading-tight">
                扫码联系您的专属护肤顾问
              </h2>
              <p className="text-[#5E5E5E] leading-relaxed mb-8 font-light">
                添加 NIHPLOD 官方护肤顾问微信，获取一对一素颜肌肤分析、产品推荐与护肤方案定制。无论是日常护理疑问，还是进阶修护需求，顾问都将为您提供专业解答。
              </p>

              <div className="space-y-4">
                {[
                  { icon: MessageCircle, text: "微信一对一咨询服务" },
                  { icon: Video, text: "线上视频面部分析解读" },
                  { icon: Phone, text: "护肤方案与产品使用指导" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-[#5E5E5E]">
                    <item.icon className="w-5 h-5 text-[#8B7355]" />
                    <span className="text-[15px] font-light">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-56 h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden border border-[rgba(61,68,48,0.1)] bg-white p-4 shadow-sm">
                <Image
                  src="/images/advisor-qr.jpg"
                  alt="NIHPLOD 专属护肤顾问微信二维码"
                  fill
                  className="object-contain p-3"
                />
              </div>
              <p className="mt-5 text-sm text-[#5E5E5E] font-light tracking-wide">
                微信扫码 · 即刻咨询
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 线下门店 */}
      <section className="py-16 md:py-24 px-6 md:px-12 lg:px-20 border-t border-[rgba(61,68,48,0.08)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.3em] text-[#8B7355] mb-4">
              Offline Stores
            </p>
            <h2 className="text-3xl md:text-4xl font-serif text-[#1A1A1A] mb-4">
              线下门店
            </h2>
            <p className="text-[#5E5E5E] font-light max-w-xl mx-auto">
              前往 NIHPLOD 官方门店或合作专柜，体验专业肌肤检测与专属护肤服务。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-12">
            {stores.map((store, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-[rgba(61,68,48,0.08)] bg-white/40 backdrop-blur-sm p-6 md:p-7 transition-all duration-500 hover:bg-white/70 hover:shadow-[0_12px_28px_rgba(61,68,48,0.06)]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[rgba(139,115,85,0.08)] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-[#8B7355]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs uppercase tracking-[0.15em] text-[#8B7355]">
                        {store.city}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-[#1A1A1A] mb-1">
                      {store.name}
                    </h3>
                    <p className="text-sm text-[#5E5E5E] font-light leading-relaxed mb-2">
                      {store.address}
                    </p>
                    <p className="text-xs text-[#5E5E5E]/70 tracking-wide">
                      营业时间：{store.hours}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 合作门店 */}
          <div className="rounded-2xl border border-[rgba(61,68,48,0.08)] bg-[rgba(139,115,85,0.03)] p-6 md:p-8">
            <h3 className="text-xl font-serif text-[#1A1A1A] mb-6">合作门店</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {partnerStores.map((store, i) => (
                <div key={i}>
                  <span className="text-xs uppercase tracking-[0.15em] text-[#8B7355] mb-2 block">
                    {store.city}
                  </span>
                  <h4 className="text-[15px] font-medium text-[#1A1A1A] mb-1">
                    {store.name}
                  </h4>
                  <p className="text-sm text-[#5E5E5E] font-light leading-relaxed">
                    {store.address}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 线上顾问 */}
      <section className="py-16 md:py-24 px-6 md:px-12 lg:px-20 border-t border-[rgba(61,68,48,0.08)]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#8B7355] mb-4">
            Online Consultant
          </p>
          <h2 className="text-3xl md:text-4xl font-serif text-[#1A1A1A] mb-5">
            线上顾问服务
          </h2>
          <p className="text-[#5E5E5E] font-light leading-relaxed mb-10 max-w-2xl mx-auto">
            无法到店？NIHPLOD 线上顾问同样为您提供专业支持。通过问卷、照片或视频，顾问将根据您的肌肤状态、生活习惯与护肤目标，定制专属方案，让高效护肤触手可及。
          </p>

          <a
            href="https://nihplod.cn/about"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 text-[15px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium transition-colors duration-500"
          >
            了解 NIHPLOD 品牌故事
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 text-center border-t border-[rgba(61,68,48,0.1)]">
        <p className="text-[11px] tracking-widest text-[#5E5E5E]/70">
          NIHPLOD 旎柏 · 源自摩纳哥的臻奢功效型护肤品牌
        </p>
      </footer>
    </main>
  );
}

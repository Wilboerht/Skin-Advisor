import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

export const metadata: Metadata = {
  title: "更多服务 | NIHPLOD",
  description: "联系 NIHPLOD 专属护肤顾问，或前往线下门店获取一对一面部肌肤分析解读。",
};

const stores = [
  { type: "Hotel SPA", name: "日出东方凯宾斯基", city: "北京", address: "北京市怀柔区雁栖湖南路11号院" },
  { type: "Hotel SPA", name: "香格里拉", city: "义乌", address: "浙江省义乌市福田路6号、8号" },
  { type: "Hotel SPA", name: "托尼洛 · 兰博基尼书苑酒店", city: "苏州", address: "江苏省苏州工业园区星港街168号" },
  { type: "Hotel SPA", name: "泰禾凯宾斯基", city: "福州", address: "福建省福州市晋安区横屿路1号" },
];

export default function ServicesPage() {
  return (
    <main className="relative min-h-screen text-[#1A1A1A] bg-[#F8F7F3]">
      <WebsiteNavbar />

      <section className="pt-32 md:pt-40 pb-20 md:pb-28 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 md:gap-20">
          {/* 左侧：线上顾问服务 */}
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-4">
              线上顾问服务
            </h1>
            <p className="text-[#5E5E5E] font-light leading-relaxed mb-8">
              添加 NIHPLOD 专属护肤顾问微信，获取一对一素颜肌肤分析、产品推荐与护肤方案定制。顾问将根据您的肌肤状态、生活习惯与护肤目标，提供专业解答与专属建议。
            </p>

            <div className="flex flex-col items-start">
              <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-[rgba(61,68,48,0.1)] bg-white p-3 shadow-sm">
                <Image
                  src="/images/advisor-qr.jpg"
                  alt="NIHPLOD 专属护肤顾问微信二维码"
                  fill
                  className="object-contain p-2"
                />
              </div>
              <p className="mt-4 text-sm text-[#5E5E5E] font-light tracking-wide">
                微信扫码 · 即刻咨询
              </p>
            </div>
          </div>

          {/* 右侧：前往线下门店 */}
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-4">
              前往线下门店
            </h1>
            <p className="text-[#5E5E5E] font-light leading-relaxed mb-8">
              前往 NIHPLOD 官方门店、合作专柜与臻选酒店水疗中心，体验专业肌肤检测与专属护肤服务。
            </p>

            <div className="space-y-5">
              {stores.map((store, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr] gap-x-3 items-start">
                  <MapPin className="w-4 h-4 text-[#8B7355] mt-1 shrink-0" />
                  <div className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-0.5 items-baseline">
                    <span className="text-xs uppercase tracking-[0.15em] text-[#8B7355]">
                      {store.city}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-medium text-[#1A1A1A]">
                        {store.name}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] rounded-full bg-[#F5F2ED] text-[#8B7355] border border-[#8B7355]/15">
                        {store.type}
                      </span>
                    </div>
                    <div className="col-start-2 text-sm text-[#5E5E5E] font-light leading-relaxed">
                      {store.address}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-8 px-6 text-center border-t border-[rgba(61,68,48,0.08)]">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#3D4430] transition-colors duration-300">
              隐私政策
            </Link>
            <span className="text-[#5E5E5E]/30">·</span>
            <Link href="/terms" className="hover:text-[#3D4430] transition-colors duration-300">
              服务条款
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

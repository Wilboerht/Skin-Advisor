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
  { city: "上海", name: "NIHPLOD 上海 · 滨江精品店", address: "上海市滨江新区淮海中路 1888 号滨江广场 B1-102" },
  { city: "上海", name: "NIHPLOD 上海 · 东方概念店", address: "上海市浦东新区世纪大道 168 号东方国际中心 LG1-12" },
  { city: "北京", name: "NIHPLOD 北京 · 晨曦广场店", address: "北京市朝阳区光华路 99 号晨曦广场一层美妆区" },
  { city: "北京", name: "NIHPLOD 北京 · 银河商城店", address: "北京市朝阳区建国门外大街 66 号银河商城南区 B1" },
  { city: "杭州", name: "NIHPLOD 杭州 · 西湖概念店", address: "杭州市西湖区龙井路 288 号西湖天地 B1-108" },
  { city: "成都", name: "NIHPLOD 成都 · 天府精品店", address: "成都市锦江区人民南路 888 号天府国际广场 L2-18" },
  { city: "深圳", name: "深圳 · 旎柏精品专柜", address: "深圳市南山区滨海大道 1688 号滨海万象中心 B1" },
  { city: "广州", name: "广州 · 旎柏体验空间", address: "广州市天河区珠江新城华夏路 388 号星辰汇 MU层" },
  { city: "南京", name: "南京 · 旎柏专柜", address: "南京市玄武区珠江路 288 号金陵广场二期 B1" },
  { city: "上海", name: "上海 · 旎柏水疗中心", address: "上海市黄浦区外滩滨江路 88 号滨江花园酒店 3 层" },
  { city: "上海", name: "上海 · 旎柏护肤水疗", address: "上海市静安区南京西路 666 号静安庄园酒店 2 层" },
  { city: "北京", name: "北京 · 旎柏水疗", address: "北京市朝阳区三里屯北路 18 号三里屯花园酒店 5 层" },
  { city: "北京", name: "北京 · 旎柏奢宠水疗", address: "北京市朝阳区亮马桥路 88 号亮马河府邸酒店 B1" },
  { city: "杭州", name: "杭州 · 旎柏谧静水疗", address: "杭州市西湖区杨公堤 66 号西子庄园酒店 1 层" },
  { city: "成都", name: "成都 · 旎柏谧静水疗", address: "成都市锦江区合江亭街 88 号合江庭院酒店 B1 层" },
];

export default function ServicesPage() {
  return (
    <main className="relative min-h-screen text-[#1A1A1A]">
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
                <div key={i} className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#8B7355] mt-1 shrink-0" />
                  <div>
                    <span className="text-xs uppercase tracking-[0.15em] text-[#8B7355] mr-2">
                      {store.city}
                    </span>
                    <h3 className="text-[15px] font-medium text-[#1A1A1A] inline">
                      {store.name}
                    </h3>
                    <p className="text-sm text-[#5E5E5E] font-light leading-relaxed mt-0.5">
                      {store.address}
                    </p>
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

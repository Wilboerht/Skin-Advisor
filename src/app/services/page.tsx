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
  { city: "上海", name: "NIHPLOD 上海恒隆广场店", address: "上海市静安区南京西路 1266 号恒隆广场 B1-108" },
  { city: "上海", name: "NIHPLOD 上海国金中心店", address: "上海市浦东新区陆家嘴世纪大道 8 号国金中心 LG1-18" },
  { city: "北京", name: "NIHPLOD 北京 SKP 店", address: "北京市朝阳区建国路 87 号 SKP 一层化妆品区" },
  { city: "北京", name: "NIHPLOD 北京国贸商城店", address: "北京市朝阳区建国路 88 号国贸商城南区 B1" },
  { city: "杭州", name: "NIHPLOD 杭州万象城店", address: "杭州市上城区富春路 701 号万象城 B1-112" },
  { city: "成都", name: "NIHPLOD 成都 IFS 店", address: "成都市锦江区红星路三段 1 号 IFS 国际金融中心 L2-08" },
  { city: "深圳", name: "深圳湾万象城 · 旎柏专柜", address: "深圳市南山区科苑南路 2888 号深圳湾万象城 B1" },
  { city: "广州", name: "广州太古汇 · 旎柏体验点", address: "广州市天河区天河路 383 号太古汇 MU层" },
  { city: "南京", name: "南京德基广场 · 旎柏专柜", address: "南京市玄武区中山路 18 号德基广场二期 B1" },
  { city: "上海", name: "上海半岛酒店 · 旎柏水疗中心", address: "上海市黄浦区中山东一路 32 号上海半岛酒店 3 层" },
  { city: "上海", name: "上海璞丽酒店 · 旎柏护肤水疗", address: "上海市静安区常德路 1 号璞丽酒店 2 层" },
  { city: "北京", name: "北京瑰丽酒店 · 旎柏水疗", address: "北京市朝阳区呼家楼京广中心北京瑰丽酒店 5 层" },
  { city: "北京", name: "北京宝格丽酒店 · 旎柏奢宠水疗", address: "北京市朝阳区新源南路 8 号院北京宝格丽酒店 B1" },
  { city: "杭州", name: "杭州西子湖四季酒店 · 旎柏水疗", address: "杭州市西湖区灵隐路 5 号杭州西子湖四季酒店 1 层" },
  { city: "成都", name: "成都博舍 · 旎柏谧静水疗", address: "成都市锦江区笔帖式街 81 号成都博舍 B1 层" },
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

          {/* 右侧：访问线下门店 */}
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-4">
              访问线下门店
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

import React, { useState, useMemo } from "react";
import type { FullAnalysisSectionProps } from "./FullAnalysisSection.types";
import { ScientificRadarChart } from "@/components/advisor/ScientificRadarChart";
import { ProductRecommendationSection } from "@/components/advisor/ProductRecommendationSection";
import { RotateCcw } from "lucide-react";

export const FullAnalysisSection: React.FC<FullAnalysisSectionProps> = ({
  result,
  faceAnalysis,
  userImage,
  sideImages = {},
  generatedAvatar,
  userNickname = "您",
  isAvatarLoading,
  avatarQueueStatus,
}) => {
  // 性别冲突弹窗状态
  const [showGenderMismatchModal, setShowGenderMismatchModal] = useState(false);
  // 性别冲突判定逻辑
  // 兼容 skinProfile.gender 不存在的情况
  const socialGender = (result?.skinProfile as any)?.gender as string | undefined;
  const faGenderVal = faceAnalysis?.gender?.value;
  const faGenderConf = faceAnalysis?.gender?.confidence || 0;
  const normalizedConf = faGenderConf > 1 ? faGenderConf / 100 : faGenderConf;
  const isGenderMismatch = useMemo(() => {
    if (!faceAnalysis?.gender || !socialGender) return false;
    return faGenderVal && normalizedConf > 0.85 && faGenderVal !== socialGender;
  }, [faceAnalysis, socialGender, faGenderVal, normalizedConf]);

  // 自动弹窗
  useMemo(() => {
    if (isGenderMismatch) setShowGenderMismatchModal(true);
  }, [isGenderMismatch]);

  // 处理按钮
  const handleMismatchRetry = () => {
    // 可根据需要清理本地缓存并跳转
    setShowGenderMismatchModal(false);
    window.location.href = "/questions";
  };
  const handleMismatchContinue = () => {
    setShowGenderMismatchModal(false);
  };

  if (!result) return null;
  return (
    <section className="w-full bg-white rounded-2xl shadow p-6 mt-4">
      {/* 性别冲突弹窗 */}
      {showGenderMismatchModal && (
        <div className="fixed inset-0 z-[300] bg-[#191919]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-[420px] overflow-hidden border border-[#E9E9E7]">
            <div className="p-8">
              <div className="flex flex-col items-center text-center gap-5 mb-6">
                <div className="text-[42px] leading-none mb-1">⚠️</div>
                <div className="space-y-1.5">
                  <h3 className="text-[18px] font-bold text-[#37352F] tracking-tight">测前信息准确性提示</h3>
                  <p className="text-[13px] text-[#787774] font-medium">Data Accuracy Verification</p>
                </div>
              </div>
              <div className="space-y-6">
                <p className="text-[14px] text-[#37352F] leading-[1.8] text-justify px-1">
                  为了确保报告建议的严谨性，智能识别引擎对多维数据进行了对冲校验，发现当前的<span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">底层算法数据模型</span>
                  与您在问卷中选择的<span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">性别选项 ({socialGender === 'male' ? '男' : '女'})</span> 存在一定程度的不一致。
                </p>
                <div className="bg-[#FBF3DB] bg-opacity-50 p-4 rounded-lg flex items-start gap-3.5 border border-[#FBF3DB]/60">
                  <span className="text-[16px] shrink-0 mt-0.5">💡</span>
                  <div className="space-y-2 text-[13px] text-[#37352F] leading-relaxed">
                    <p className="opacity-90">这可能会影响为您匹配<span className="font-bold">“针对性护肤方案”</span>的精准度，导致分析结论与您的实际肤感产生偏差。</p>
                    <div className="h-px bg-[#37352F]/5 w-full my-1"></div>
                    <p className="opacity-90">建议核实信息以获得更准确的建议。若是填写有误？<span className="font-semibold text-[#D9730D]">本次重新填写不消耗测试次数</span>。</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleMismatchContinue}
                    className="w-full h-11 bg-[#37352F] text-white text-[14px] font-medium rounded-[6px] hover:bg-[#2C2C2C] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>信息无误</span>
                  </button>
                  <button
                    onClick={handleMismatchRetry}
                    className="w-full h-11 bg-transparent text-[#787774] text-[14px] font-medium rounded-[6px] hover:bg-[#F1F1EF] hover:text-[#37352F] active:bg-[#E9E9E7] transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} strokeWidth={2.5} />
                    <span>我填错了，重新填写</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 头像与昵称 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border">
          <img
            src={generatedAvatar || userImage || "/user-placeholder.svg"}
            alt="avatar"
            className="w-full h-full object-cover object-top"
          />
        </div>
        <div>
          <div className="font-semibold text-lg">{userNickname}的肌肤诊断报告</div>
        </div>
      </div>
      {/* 综合评分、肌肤年龄、肤质类型、关注点 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-gray-500 text-xs">综合评分</div>
          <div className="text-2xl font-bold text-[#5c4937]">
            {faceAnalysis?.overallScore ?? result.skinProfile?.skinAge ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">肌肤年龄</div>
          <div className="text-2xl font-bold text-[#5c4937]">
            {result.skinProfile?.skinAge ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">肤质类型</div>
          <div className="text-base font-semibold">
            {result.skinProfile?.typeLabel ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">关注点</div>
          <div className="text-base font-semibold">
            {result.skinProfile?.concerns?.join("、") || "-"}
          </div>
        </div>
      </div>
      {/* AI分析摘要与详情 */}
      <div className="mb-4">
        <div className="text-gray-500 text-xs mb-2">AI分析摘要</div>
        <div className="bg-[#f8f5ef] rounded p-3 text-sm mb-2">
          {result.analysis?.summary}
        </div>
        <ul className="list-disc pl-5 text-sm text-gray-700">
          {result.analysis?.details?.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
      {/* 详细维度雷达图 */}
      {faceAnalysis?.dimensions && (
        <div className="mb-6">
          <div className="text-gray-500 text-xs mb-2">多维度雷达图</div>
          <ScientificRadarChart dimensions={faceAnalysis.dimensions} />
        </div>
      )}
      {/* 产品推荐 */}
      {result.products && result.products.length > 0 && (
        <div className="mb-6">
          <div className="text-gray-500 text-xs mb-2">专属产品推荐</div>
          {/* 兼容 price 字段为 undefined 的情况 */}
          <ProductRecommendationSection products={result.products?.map(p => ({ ...p, price: p.price ?? '' }))} />
        </div>
      )}
      {/* 详细维度列表 */}
      {faceAnalysis?.dimensions && (
        <div className="mb-4">
          <div className="text-gray-500 text-xs mb-2">详细维度</div>
          <ul className="grid grid-cols-2 gap-2">
            {Object.entries(faceAnalysis.dimensions).map(([key, dim]) => (
              <li key={key} className="bg-[#f8f5ef] rounded p-2 text-sm">
                <span className="font-semibold">{key}：</span>
                <span>
                  分数 {dim?.score ?? "-"}，分位 {dim?.percentile ?? "-"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* TODO: 可继续补充实验室数据、AI问答、PDF下载等内容 */}
      {/* 实验室数据区块 */}
      {faceAnalysis?.hydration && (
        <div className="mb-6">
          <div className="text-gray-500 text-xs mb-2">实验室水分检测</div>
          <div className="bg-[#f8f5ef] rounded p-3 text-sm">
            <div>水分等级：{faceAnalysis.hydration.level}</div>
            <div>百分比：{faceAnalysis.hydration.percent ?? '-'}%</div>
            <div>描述：{faceAnalysis.hydration.description}</div>
          </div>
        </div>
      )}
    </section>
  );
};

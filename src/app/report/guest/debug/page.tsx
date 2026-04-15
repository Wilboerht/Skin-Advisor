'use client';

import ShareLandingClient from '../ShareLandingClient';

export default function DebugSharePage() {
  // Mock data that matches EXACTLY what page.tsx passes
  const mockData = {
    score: 92,
    skinAge: 24,
    nickname: '皮肤检测官',
    generatedAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=official`,
    sessionId: 'debug-session-001',
    dimensions: {
      waterOil: {
        score: 75,
        percentile: 96,
        grade: 'A',
        details: 'T区水油平衡良好'
      },
      skin_condition: {
        score: 88,
        percentile: 92,
        grade: 'A',
        details: '皮肤状态良好'
      },
      wrinkles: {
        score: 85,
        percentile: 89,
        grade: 'A',
        details: '细纹轻微'
      },
      texture: {
        score: 81,
        percentile: 87,
        grade: 'B',
        details: '皮肤纹理细腻'
      },
      pores: {
        score: 79,
        percentile: 84,
        grade: 'B',
        details: '毛孔状态良好'
      }
    },
    // Additional fields from real page.tsx
    skinType: '混合型肤质',
    publishDate: new Date().toLocaleDateString(),
    city: '北京',
    isGuest: true,
    detectedGender: {
      value: 'female',
      confidence: 0.92
    },
    guestAnalysis: {
      summary: '您的皮肤状态总体良好，特别是T区水油平衡表现出色。建议继续保持现有护肤习惯，加强防晒和保湿工作。',
      concerns: ['细纹', '毛孔'],
      tips: ['早晚使用补水面膜', '加强日常防晒保护', '定期深层清洁'],
      skinTypeKey: 'combination',
      hydrationLevel: 'good'
    }
  };

  return (
    <div>
      <ShareLandingClient data={mockData} />
      
      {/* Debug Info Footer */}
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-4 text-center text-sm text-gray-600 sticky bottom-0">
        <p>🔧 这是调试页面 - 访问 <code className="bg-gray-200 px-2 py-1 rounded">/report/guest/debug</code></p>
        <p className="text-xs mt-2">使用完整的模拟数据（与真实 page.tsx 一致），方便快速调试 UI 样式和交互</p>
      </div>
    </div>
  );
}

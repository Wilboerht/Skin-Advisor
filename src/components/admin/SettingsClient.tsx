"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, RefreshCw, Key, MessageSquare, Monitor, Database, Shield, CheckCircle, Sliders, Activity, Zap, AlertTriangle, Info, Package } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface SettingsData {
    // AI Model
    aiProvider: string;
    aiModel: string;
    systemPrompt: string;
    strictJsonMode: boolean;
    visionAnalysis: boolean;

    // AI Parameters
    temperature: number;
    maxTokens: number;
    topP: number;

    // Analysis Sensitivity
    skinIssueThreshold: number;  // 0-100, higher = more sensitive to skin issues
    acneSensitivity: number;     // 0-100
    wrinkleSensitivity: number;  // 0-100
    pigmentSensitivity: number;  // 0-100

    // Feature Flags
    enableDetailedAnalysis: boolean;
    enableProductRecommendations: boolean;
    enableRoutineSuggestions: boolean;

    // Inventory Management
    stockAlertThreshold: number; // Products below this level trigger alerts
}

const DEFAULT_SETTINGS: SettingsData = {
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    systemPrompt: '',
    strictJsonMode: true,
    visionAnalysis: true,
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.95,
    skinIssueThreshold: 50,
    acneSensitivity: 50,
    wrinkleSensitivity: 50,
    pigmentSensitivity: 50,
    enableDetailedAnalysis: true,
    enableProductRecommendations: true,
    enableRoutineSuggestions: true,
    stockAlertThreshold: 10,
};

export default function SettingsClient() {
    const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const toast = useToast();

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSettings(prev => ({ ...prev, ...data.data }));
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });

            if (res.ok) {
                setSaved(true);
                toast.success('设置已保存');
                setTimeout(() => setSaved(false), 3000);
            } else {
                toast.error('保存失败');
            }
        } catch (e) {
            toast.error('网络错误');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">系统设置</h1>
                    <p className="text-slate-500 text-sm mt-1">配置 AI 核心参数与系统运行偏好</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : saved ? (
                        <CheckCircle className="mr-2 h-4 w-4 text-emerald-400" />
                    ) : (
                        <Save className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                    )}
                    {saved ? '设置已保存' : '提交更改'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: AI Configuration */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Model Settings */}
                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">AI 模型配置</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-0.5">AI 服务商</label>
                                    <select
                                        value={settings.aiProvider}
                                        onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
                                        className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-slate-500/5 focus:border-slate-400 py-2.5 transition-all"
                                    >
                                        <option value="openai">OpenAI (推荐)</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="azure">Azure OpenAI</option>
                                        <option value="deepseek">DeepSeek</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-0.5">模型版本</label>
                                    <input
                                        type="text"
                                        value={settings.aiModel}
                                        onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                                        className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-slate-500/5 focus:border-slate-400 py-2.5 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-0.5">系统提示词 / AI 人设</label>
                                <textarea
                                    value={settings.systemPrompt}
                                    onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                                    className="w-full rounded-lg border-slate-200 text-sm bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-slate-500/5 focus:border-slate-400 min-h-[140px] p-3 transition-all leading-relaxed"
                                    placeholder="You are an expert dermatologist specializing in skincare routine optimization..."
                                />
                                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                                    <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        此提示词将作为 AI 顾问的核心逻辑基础，直接决定诊断建议的专业度。
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between group">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800">严格 JSON 模式</label>
                                        <p className="text-xs text-slate-500">强制 AI 只返回结构化数据（系统稳定性核心）</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, strictJsonMode: !settings.strictJsonMode })}
                                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all ${settings.strictJsonMode ? 'bg-slate-900' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${settings.strictJsonMode ? 'translate-x-[22px]' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800">视觉分析</label>
                                        <p className="text-xs text-slate-500">启用多模态图像识别处理（启用 GPT-4o 视觉能力）</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, visionAnalysis: !settings.visionAnalysis })}
                                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all ${settings.visionAnalysis ? 'bg-slate-900' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${settings.visionAnalysis ? 'translate-x-[22px]' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Parameters */}
                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Sliders className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">模型参数</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Temperature */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700">Temperature</label>
                                    <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{settings.temperature.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.05"
                                    value={settings.temperature}
                                    onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>精确 (0)</span>
                                    <span>平衡</span>
                                    <span>创意 (2)</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 flex items-start gap-1">
                                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                    较低值使回复更确定、一致；较高值增加创意和多样性
                                </p>
                            </div>

                            {/* Max Tokens */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700">最大 Token 数</label>
                                    <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{settings.maxTokens}</span>
                                </div>
                                <input
                                    type="range"
                                    min="512"
                                    max="8192"
                                    step="256"
                                    value={settings.maxTokens}
                                    onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>512</span>
                                    <span>4096</span>
                                    <span>8192</span>
                                </div>
                            </div>

                            {/* Top P */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700">Top P (核采样)</label>
                                    <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{settings.topP.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.05"
                                    value={settings.topP}
                                    onChange={(e) => setSettings({ ...settings, topP: parseFloat(e.target.value) })}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>集中 (0.1)</span>
                                    <span>推荐 (0.95)</span>
                                    <span>全部 (1)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Analysis Sensitivity */}
                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">分析灵敏度</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800">
                                    灵敏度越高，AI 将更容易检测到轻微的皮肤问题。建议保持默认值，过高可能导致误报。
                                </p>
                            </div>

                            {/* Overall Threshold */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700">总体检测阈值</label>
                                    <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{settings.skinIssueThreshold}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="90"
                                    step="5"
                                    value={settings.skinIssueThreshold}
                                    onChange={(e) => setSettings({ ...settings, skinIssueThreshold: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gradient-to-r from-emerald-200 via-amber-200 to-rose-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>宽松</span>
                                    <span>标准</span>
                                    <span>严格</span>
                                </div>
                            </div>

                            {/* Specific Sensitivities */}
                            <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-100">
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">细分项目</div>

                                {/* Acne */}
                                <div className="flex items-center gap-4">
                                    <div className="w-24 text-sm text-slate-600">痘痘检测</div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="90"
                                        step="5"
                                        value={settings.acneSensitivity}
                                        onChange={(e) => setSettings({ ...settings, acneSensitivity: parseInt(e.target.value) })}
                                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                    />
                                    <span className="w-10 text-right text-sm font-mono text-slate-500">{settings.acneSensitivity}%</span>
                                </div>

                                {/* Wrinkle */}
                                <div className="flex items-center gap-4">
                                    <div className="w-24 text-sm text-slate-600">皱纹检测</div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="90"
                                        step="5"
                                        value={settings.wrinkleSensitivity}
                                        onChange={(e) => setSettings({ ...settings, wrinkleSensitivity: parseInt(e.target.value) })}
                                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                    <span className="w-10 text-right text-sm font-mono text-slate-500">{settings.wrinkleSensitivity}%</span>
                                </div>

                                {/* Pigment */}
                                <div className="flex items-center gap-4">
                                    <div className="w-24 text-sm text-slate-600">色素检测</div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="90"
                                        step="5"
                                        value={settings.pigmentSensitivity}
                                        onChange={(e) => setSettings({ ...settings, pigmentSensitivity: parseInt(e.target.value) })}
                                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <span className="w-10 text-right text-sm font-mono text-slate-500">{settings.pigmentSensitivity}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feature Toggles */}
                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">功能开关</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">详细分析报告</label>
                                    <p className="text-xs text-slate-500">生成包含区域细节的完整分析</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, enableDetailedAnalysis: !settings.enableDetailedAnalysis })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableDetailedAnalysis ? 'bg-slate-900' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.enableDetailedAnalysis ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">产品推荐</label>
                                    <p className="text-xs text-slate-500">在报告中包含个性化产品推荐</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, enableProductRecommendations: !settings.enableProductRecommendations })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableProductRecommendations ? 'bg-slate-900' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.enableProductRecommendations ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">护肤建议</label>
                                    <p className="text-xs text-slate-500">生成日常护肤流程建议</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, enableRoutineSuggestions: !settings.enableRoutineSuggestions })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableRoutineSuggestions ? 'bg-slate-900' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.enableRoutineSuggestions ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Management */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                            <Package className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">库存管理</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <label className="text-sm font-bold text-slate-800">低库存预警阈值</label>
                                        <p className="text-xs text-slate-500">当库存低于此数值时，侧边栏和产品列表将显示红色警告</p>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">{settings.stockAlertThreshold || 10} 件</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    step="1"
                                    value={settings.stockAlertThreshold || 10}
                                    onChange={(e) => setSettings({ ...settings, stockAlertThreshold: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-slate-300 mt-2 px-1 uppercase tracking-widest">
                                    <span>极少 (1)</span>
                                    <span>常规 (10)</span>
                                    <span>充足 (50)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* API Keys */}
                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Key className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">API 密钥</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-500">
                                API 密钥通过环境变量配置，出于安全考虑不在此处显示。
                                请通过 <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">.env</code> 文件或部署平台进行管理。
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <span className="text-slate-500">OPENAI_API_KEY</span>
                                    <span className="block mt-1 font-mono text-slate-400">sk-••••••••</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <span className="text-slate-500">ANTHROPIC_API_KEY</span>
                                    <span className="block mt-1 font-mono text-slate-400">sk-ant-••••••••</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: System Stats */}
                <div className="space-y-6">
                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Database className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">系统状态</h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">数据库</span>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        已连接
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">当前服务商</span>
                                    <span className="text-sm font-medium text-slate-900">{settings.aiProvider}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">模型</span>
                                    <span className="text-sm font-mono text-slate-600">{settings.aiModel}</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    清除缓存
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)] overflow-hidden">
                        <div className="px-6 py-5 bg-white/30 border-b border-white/20 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">管理员访问</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-4">
                                您当前以超级管理员身份登录。
                            </p>
                            <button className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                                管理员账户
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

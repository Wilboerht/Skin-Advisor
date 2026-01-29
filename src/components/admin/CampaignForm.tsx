"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Calendar as CalendarIcon, Upload } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface CampaignFormProps {
    initialData?: CampaignData | null;
    isEdit?: boolean;
}

interface CampaignData {
    id?: string;
    name: string;
    description: string;
    rewardType: string;
    rewardDescription: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    maxParticipants: number;
    rules: string;
    bannerImage: string;
}

export default function CampaignForm({ initialData, isEdit = false }: CampaignFormProps) {
    const router = useRouter();
    const toast = useToast();
    const [submitting, setSubmitting] = useState(false);

    // Default form state
    const [formData, setFormData] = useState<CampaignData>({
        name: "",
        description: "",
        rewardType: "sample",
        rewardDescription: "",
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
        isActive: true,
        maxParticipants: 100,
        rules: "",
        bannerImage: "",
        ...initialData
    });

    // Handle date formatting for input type="date"
    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : "",
                endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : "",
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleToggle = (checked: boolean) => {
        setFormData(prev => ({ ...prev, isActive: checked }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const url = isEdit && initialData?.id
                ? `/api/admin/campaigns/${initialData.id}`
                : '/api/admin/campaigns';

            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Operation failed');
            }

            toast.success(isEdit ? "活动已更新" : "活动已创建");
            router.push('/admin/campaigns');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "保存失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/campaigns"
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {isEdit ? "编辑活动" : "新建活动"}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {isEdit ? "修改活动详情与规则" : "配置新的营销活动"}
                        </p>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            保存中...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            保存活动
                        </>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">基本信息</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    活动名称 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="例如：夏季护肤挑战赛"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    活动描述
                                </label>
                                <textarea
                                    name="description"
                                    rows={3}
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="简短描述活动的目和内容..."
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        开始日期 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="startDate"
                                            required
                                            value={formData.startDate}
                                            onChange={handleChange}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 pl-10"
                                        />
                                        <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        结束日期 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="endDate"
                                            required
                                            value={formData.endDate}
                                            onChange={handleChange}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 pl-10"
                                        />
                                        <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">奖励设置</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        奖励类型
                                    </label>
                                    <select
                                        name="rewardType"
                                        value={formData.rewardType}
                                        onChange={handleChange}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                    >
                                        <option value="sample">产品小样</option>
                                        <option value="coupon">优惠券</option>
                                        <option value="gift">正装礼品</option>
                                        <option value="points">积分奖励</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        参与人数上限
                                    </label>
                                    <input
                                        type="number"
                                        name="maxParticipants"
                                        value={formData.maxParticipants}
                                        onChange={handleChange}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    奖励详情描述
                                </label>
                                <input
                                    type="text"
                                    name="rewardDescription"
                                    value={formData.rewardDescription}
                                    onChange={handleChange}
                                    placeholder="例如：免费领取光蕴精华试用装一份"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    详细规则说明
                                </label>
                                <textarea
                                    name="rules"
                                    rows={5}
                                    value={formData.rules}
                                    onChange={handleChange}
                                    placeholder="每行一条规则..."
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">状态设置</h2>

                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <p className="text-sm font-medium text-slate-900">启用活动</p>
                                <p className="text-xs text-slate-500 mt-0.5">启用后将自动停用其他活动</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.isActive}
                                    onChange={(e) => handleToggle(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Banner 图片 URL
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="bannerImage"
                                    value={formData.bannerImage}
                                    onChange={handleChange}
                                    placeholder="https://..."
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                />
                                {/* Placeholder for upload button if needed */}
                                <button type="button" className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                                    <Upload className="h-4 w-4 text-slate-500" />
                                </button>
                            </div>
                            {formData.bannerImage && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50">
                                    <img
                                        src={formData.bannerImage}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}

"use client";

import { Clock, Smartphone, Settings, Save, User as UserIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { AdminModal } from "@/components/ui/AdminModal";
import { useMounted } from "@/hooks/use-mounted";
import { isDisabledUser, UserRole } from "@/lib/permissions";

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onUpdate?: () => void;
}

interface UserDetail {
  id: string;
  email: string;
  phoneNumber?: string;
  name: string | null;
  role: string;
  dailyTestLimit: number;
  createdAt: string;
  advisorSessions: any[];
  _count?: {
    testRecords?: number;
  };
}

export function UserDetailModal({ isOpen, onClose, userId, onUpdate }: UserDetailModalProps) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [editingLimit, setEditingLimit] = useState(false);
  const [newLimit, setNewLimit] = useState(1);
  const [saving, setSaving] = useState(false);
  const [limitDirty, setLimitDirty] = useState(false);
  const toast = useToast();
  const mounted = useMounted();
  const abortRef = useRef<AbortController | null>(null);

  const fetchUserDetails = useCallback(() => {
    if (!userId) return;
    // 取消之前的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setFetchError(false);
    fetch(`/api/admin/users/${userId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setUser(data);
        setNewLimit(data.dailyTestLimit || 1);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setUser(null);
        setFetchError(true);
      })
      .finally(() => {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserDetails();
    } else {
      // 关闭时取消所有进行中的请求
      abortRef.current?.abort();
      abortRef.current = null;
      setUser(null);
      setFetchError(false);
      setEditingLimit(false);
      setLimitDirty(false);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen, userId, fetchUserDetails]);

  const handleSaveLimit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTestLimit: newLimit }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser({ ...user, dailyTestLimit: updated.dailyTestLimit });
        setEditingLimit(false);
        setLimitDirty(false);
        toast.success("测试次数限制已更新");
        onUpdate?.();
      } else {
        toast.error("更新失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    if (limitDirty) {
      if (!window.confirm("您有未保存的测试次数更改，确定要关闭吗？")) return;
      setLimitDirty(false);
    }
    onClose();
  }, [limitDirty, onClose]);

  if (!mounted) return null;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={handleClose}
      titleId="user-detail-modal-title"
      maxWidth="lg"
      headerIcon={
        <div className="w-10 h-10 rounded-xl bg-[#1A1A1A]/5 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-[#1A1A1A]/60" />
        </div>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1A1A1A]/30" />
          <p className="mt-4 text-sm text-[#1A1A1A]/40">加载用户详情中...</p>
        </div>
      ) : fetchError || !user ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <p className="text-sm text-[#1A1A1A]/50">加载用户详情失败</p>
          <button
            onClick={fetchUserDetails}
            className="px-4 py-2 text-sm rounded-lg border border-[#E9E9E7] text-[#5E5E5E] hover:bg-[#1A1A1A]/[0.02] transition-colors"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A]">{user.name || "匿名用户"}</h2>
            <p className="text-[#1A1A1A]/50 font-mono text-sm mt-1">{user.email || user.phoneNumber}</p>
            <div className="flex items-center gap-3 mt-4">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isDisabledUser(user.role) ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                }`}
              >
                {isDisabledUser(user.role) ? UserRole.DISABLED : user.role}
              </span>
              <span className="text-xs text-[#1A1A1A]/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                注册于 {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
            <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> 测试次数限制
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#1A1A1A]/60">每日测试次数上限</p>
                <p className="text-xs text-[#1A1A1A]/40 mt-1">默认为 1 次，可为特定用户调整</p>
              </div>
              {editingLimit ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newLimit}
                    onChange={(e) => { setNewLimit(Math.max(1, parseInt(e.target.value) || 1)); setLimitDirty(true); }}
                    className="w-20 px-3 py-1.5 border border-[#E9E9E7] rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleSaveLimit}
                    disabled={saving}
                    className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingLimit(false);
                      setNewLimit(user.dailyTestLimit || 1);
                    }}
                    className="px-3 py-1.5 text-[#1A1A1A]/50 text-sm hover:bg-[#1A1A1A]/5 rounded-lg"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-amber-700">{user.dailyTestLimit || 1}</span>
                  <span className="text-sm text-[#1A1A1A]/50">次/天</span>
                  <button
                    onClick={() => setEditingLimit(true)}
                    className="px-3 py-1.5 text-amber-700 text-sm border border-amber-200 rounded-lg hover:bg-amber-100"
                  >
                    修改
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-[#1A1A1A]/[0.02] rounded-xl p-5 border border-[#E9E9E7]">
              <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 最近分析记录
              </h3>
              {user.advisorSessions && user.advisorSessions.length > 0 ? (
                <div className="space-y-3">
                  {user.advisorSessions.slice(0, 3).map((session, idx) => (
                    <div key={idx} className="flex items-start justify-between text-sm">
                      <div>
                        <div className="font-medium text-[#5E5E5E]">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-[#1A1A1A]/50 mt-0.5 flex gap-1 items-center">
                          {session.deviceType === "mobile" ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            "桌面端"
                          )}
                          <span>&bull;</span>
                          {session.province || "未知位置"}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          session.completedAt
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {session.completedAt ? "已完成" : "已中断"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#1A1A1A]/40 italic">暂无分析记录</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

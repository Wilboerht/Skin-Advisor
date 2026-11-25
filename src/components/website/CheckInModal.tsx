"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithCsrf, POINTS_CHANGED_EVENT } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { localDateStr } from "@/lib/local-date";
import { STATE_META, type DiaryEntry } from "./DiaryTimeline";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const SKIN_TAGS = ["出油", "干燥", "暗沉", "泛红", "痘痘", "闭口", "局部受损"];
const SITUATION_TAGS = ["熬夜", "换季", "姨妈期", "压力", "医美", "醉酒", "暴晒"];
const STATE_KEYS = ["great", "good", "normal", "bad", "terrible"] as const;

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    existing: DiaryEntry | null;
    dateStr?: string;
    onSaved: () => void;
    onAuthExpired?: () => void;
}

/**
 * CheckInModal — 护肤打卡弹层
 * 统一 ResponsiveDialog / RadioGroup / Button / Textarea
 */
export function CheckInModal({
    isOpen,
    onClose,
    existing,
    dateStr,
    onSaved,
    onAuthExpired,
}: CheckInModalProps) {
    const toast = useToast();
    const [skinState, setSkinState] = useState<string>("good");
    const [tags, setTags] = useState<string[]>([]);
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);

    const [todayOnOpen, setTodayOnOpen] = useState(() => localDateStr(new Date()));
    useEffect(() => {
        if (isOpen) setTodayOnOpen(localDateStr(new Date()));
    }, [isOpen]);

    const targetDate = dateStr ?? todayOnOpen;
    const isToday = targetDate === todayOnOpen;
    const targetLabel = new Date(`${targetDate}T00:00:00.000Z`).toLocaleDateString(
        "zh-CN",
        {
            month: "numeric",
            day: "numeric",
            timeZone: "UTC",
        },
    );

    useEffect(() => {
        if (!isOpen) return;
        setSkinState(
            existing?.skinState && STATE_META[existing.skinState]
                ? existing.skinState
                : "good",
        );
        setTags(existing?.tags?.slice(0, 5) ?? []);
        setNote(existing?.note ?? "");
    }, [isOpen, existing]);

    const toggleTag = (tag: string) => {
        if (tags.includes(tag)) {
            setTags(tags.filter((item) => item !== tag));
            return;
        }
        if (tags.length >= 5) {
            toast.info("最多选择 5 个标签");
            return;
        }
        setTags([...tags, tag]);
    };

    const handleSave = async () => {
        if (saving || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
            const submitDate = dateStr ?? localDateStr(new Date());
            const submitIsToday = submitDate === localDateStr(new Date());
            const res = await fetchWithCsrf("/api/user/diary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: submitDate,
                    skinState,
                    tags,
                    note: note.trim() || undefined,
                }),
            });
            if (!res.ok) {
                if (res.status === 401) {
                    onAuthExpired?.();
                    return;
                }
                const errData = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                throw new Error(errData?.error || "保存未成功");
            }
            const resData = (await res.json().catch(() => null)) as {
                points?: { granted?: number };
            } | null;
            const granted = resData?.points?.granted ?? 0;
            const pointsSuffix = granted > 0 ? `，+${granted} 积分` : "";
            if (granted > 0 && typeof window !== "undefined") {
                window.dispatchEvent(new Event(POINTS_CHANGED_EVENT));
            }
            const submitLabel = new Date(
                `${submitDate}T00:00:00.000Z`,
            ).toLocaleDateString("zh-CN", {
                month: "numeric",
                day: "numeric",
                timeZone: "UTC",
            });
            toast.success(
                existing
                    ? submitIsToday
                        ? "今日记录已更新"
                        : "记录已更新"
                    : submitIsToday
                      ? `打卡成功${pointsSuffix}`
                      : `已补打卡 ${submitLabel}${pointsSuffix}`,
            );
            onSaved();
            onClose();
        } catch (err) {
            console.error("Diary check-in error:", err);
            const message =
                err instanceof Error &&
                err.message &&
                err.message !== "保存未成功"
                    ? err.message
                    : "保存未成功，请稍后再试";
            toast.error(message);
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const noteHint = existing
        ? "编辑已有记录不重复发放积分"
        : !isToday
          ? "补打卡不发放积分"
          : null;

    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={
                existing
                    ? isToday
                        ? "编辑今日记录"
                        : `编辑记录 · ${targetLabel}`
                    : isToday
                      ? "今日打卡"
                      : `补打卡 · ${targetLabel}`
            }
            size="md"
            footer={
                <div className="w-full space-y-2">
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={saving}
                        className="w-full"
                    >
                        {existing ? "保存修改" : "完成打卡"}
                    </Button>
                    {noteHint && (
                        <p className="text-center text-xs text-muted-foreground">
                            {noteHint}
                        </p>
                    )}
                </div>
            }
        >
            <div className="space-y-5">
                <RadioGroup
                    value={skinState}
                    onValueChange={setSkinState}
                    aria-label="肌肤状态"
                    className="grid grid-cols-5 gap-1"
                >
                    {STATE_KEYS.map((key) => {
                        const meta = STATE_META[key];
                        const Icon = meta.icon;
                        const selected = skinState === key;
                        const id = `checkin-state-${key}`;
                        return (
                            <label
                                key={key}
                                htmlFor={id}
                                className={cn(
                                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border py-2.5 text-center transition-colors",
                                    selected
                                        ? "border-primary bg-accent"
                                        : "border-transparent hover:bg-accent/50",
                                )}
                            >
                                <RadioGroupItem
                                    value={key}
                                    id={id}
                                    className="sr-only"
                                />
                                <span
                                    style={{
                                        color: selected ? meta.color : undefined,
                                    }}
                                >
                                    <Icon className="size-6" strokeWidth={1.5} />
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {meta.label}
                                </span>
                            </label>
                        );
                    })}
                </RadioGroup>

                <div className="space-y-3">
                    {[
                        { caption: "肌肤表现", list: SKIN_TAGS },
                        { caption: "其他因素", list: SITUATION_TAGS },
                    ].map((group) => (
                        <div key={group.caption}>
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                                {group.caption}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {group.list.map((tag) => {
                                    const selected = tags.includes(tag);
                                    return (
                                        <Button
                                            key={tag}
                                            type="button"
                                            size="sm"
                                            variant={
                                                selected ? "default" : "outline"
                                            }
                                            onClick={() => toggleTag(tag)}
                                            aria-pressed={selected}
                                            className="rounded-full"
                                        >
                                            {tag}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <Textarea
                    value={note}
                    onChange={(event) =>
                        setNote(event.target.value.slice(0, 200))
                    }
                    rows={3}
                    placeholder="今天用了什么、肌肤有什么变化…（选填）"
                    className="resize-none bg-transparent"
                />
            </div>
        </ResponsiveDialog>
    );
}

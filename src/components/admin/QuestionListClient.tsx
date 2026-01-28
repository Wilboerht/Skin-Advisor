"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GripVertical, Edit, Trash2, Eye, EyeOff, Save, RotateCcw, Loader2 } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

// --- Types ---
interface QuestionListProps {
    initialQuestions: any[];
}

// --- Sortable Item Component ---
function SortableItem({ id, question, index, onToggleStatus }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    };

    const optionsCount = Array.isArray(question.options)
        ? question.options.length
        : (JSON.parse(question.options as string) || []).length;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-4 p-4 mb-3 bg-white border rounded-xl transition-all",
                isDragging
                    ? "shadow-xl border-[#1A1A1A]/30 scale-[1.02] rotate-1"
                    : "border-[#1A1A1A]/5 hover:border-[#1A1A1A]/20 shadow-sm"
            )}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="cursor-move p-2 text-[#1A1A1A]/20 hover:text-[#1A1A1A]/60 transition-colors"
            >
                <GripVertical className="w-5 h-5" />
            </div>

            <div className="w-12 text-xs font-mono text-[#1A1A1A]/40 font-medium">#{index + 1}</div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#1A1A1A] truncate">{question.question}</h3>
                <div className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1A1A1A]/5 text-[10px] uppercase font-bold tracking-wider text-[#1A1A1A]/60">
                        {question.fieldName}
                    </span>
                    <span className="text-xs text-[#1A1A1A]/40">
                        {optionsCount} options • {question.type}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onToggleStatus(question.id, !question.active)}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        question.active
                            ? "text-[#3D4430] hover:bg-[#3D4430]/10"
                            : "text-[#1A1A1A]/20 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A]/60"
                    )}
                    title={question.active ? "Deactivate" : "Activate"}
                >
                    {question.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <button className="p-2 rounded-lg text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-colors">
                    <Edit className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// --- Main Client Component ---
export default function QuestionListClient({ initialQuestions }: QuestionListProps) {
    const router = useRouter();
    const toast = useToast();
    const [questions, setQuestions] = useState(initialQuestions);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setQuestions((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over!.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setHasChanges(true);
        }
    };

    const handleToggleStatus = (id: string, active: boolean) => {
        setQuestions(prev => prev.map(q =>
            q.id === id ? { ...q, active } : q
        ));
        setHasChanges(true);
    };

    const handleSeed = async () => {
        if (!confirm("This will overwrite database questions with default config. Continue?")) return;
        setIsSaving(true);
        try {
            // Need a dedicated seed API or action
            const res = await fetch('/api/admin/questions/seed', { method: 'POST' });
            if (res.ok) {
                toast.success("Default questions loaded");
                router.refresh();
            } else {
                toast.error("Seeding failed");
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveOrder = async () => {
        setIsSaving(true);
        try {
            const updates = questions.map((q, index) => ({
                id: q.id,
                order: index,
                active: q.active
            }));

            // Batch update API
            const res = await fetch('/api/admin/questions/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });

            if (res.ok) {
                toast.success("Changes saved");
                setHasChanges(false);
                router.refresh();
            } else {
                toast.error("Save failed");
            }
        } catch (e) {
            toast.error("Error saving changes");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-[#1A1A1A]">Questionnaire</h1>
                    <p className="text-[#1A1A1A]/60 text-sm mt-1">Drag and drop to reorder survey flow.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Show Seed Button only if empty */}
                    {questions.length === 0 && (
                        <button
                            onClick={handleSeed}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center rounded-full border border-[#1A1A1A]/10 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[#1A1A1A] hover:bg-[#FDFBF7] transition-all"
                        >
                            <RotateCcw className="mr-2 h-3.5 w-3.5" />
                            Load Defaults
                        </button>
                    )}

                    <button
                        onClick={() => { }}
                        className="inline-flex items-center justify-center rounded-full bg-[#1A1A1A] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-[#1A1A1A]/10 hover:bg-[#3D4430] hover:scale-105 transition-all"
                    >
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Add Question
                    </button>
                </div>
            </div>

            {/* Save Banner */}
            {hasChanges && (
                <div className="sticky top-4 z-50 flex items-center justify-between bg-[#3D4430] text-white px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-top-2">
                    <span className="text-sm font-medium">You have unsaved changes.</span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setQuestions(initialQuestions);
                                setHasChanges(false);
                            }}
                            className="text-xs hover:text-white/80"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSaveOrder}
                            disabled={isSaving}
                            className="bg-white text-[#3D4430] px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-[#FDFBF7]"
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {questions.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-[#1A1A1A]/10 p-12 text-center bg-[#1A1A1A]/[0.02]">
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center mb-4 text-[#1A1A1A]/40">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-serif text-[#1A1A1A] mb-2">No active questions</h3>
                        <p className="text-sm text-[#1A1A1A]/60 max-w-sm mx-auto mb-6">
                            The questionnaire is currently empty. You can initialize it with the default question set.
                        </p>
                        <button
                            onClick={handleSeed}
                            className="text-sm font-medium text-[#1A1A1A] underline decoration-1 underline-offset-4 hover:text-[#3D4430]"
                        >
                            Initialize Default Questions
                        </button>
                    </div>
                </div>
            )}

            {/* Draggable List */}
            {questions.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={questions.map((q) => q.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="max-w-3xl">
                            {questions.map((q, index) => (
                                <SortableItem
                                    key={q.id}
                                    id={q.id}
                                    question={q}
                                    index={index}
                                    onToggleStatus={handleToggleStatus}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { STAR_INGREDIENTS, INGREDIENT_CATEGORIES, type Ingredient } from "@/config/ingredients";
import { Search, X, Plus, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IngredientSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

export function IngredientSelector({ selectedIds, onChange }: IngredientSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredIngredients = STAR_INGREDIENTS.filter(ing => {
        if (selectedIds.includes(ing.id)) return false;
        const q = searchQuery.toLowerCase();
        return ing.name.toLowerCase().includes(q) ||
            ing.nameEn.toLowerCase().includes(q) ||
            ing.effects.some(e => e.toLowerCase().includes(q));
    });

    const selectedIngredients = STAR_INGREDIENTS.filter(ing => selectedIds.includes(ing.id));

    const handleSelect = (id: string) => {
        onChange([...selectedIds, id]);
        setSearchQuery("");
    };

    const handleRemove = (id: string) => {
        onChange(selectedIds.filter(i => i !== id));
    };

    // Check for conflicts
    const conflicts = selectedIngredients.reduce((acc, ing) => {
        if (ing.incompatibleWith) {
            ing.incompatibleWith.forEach(incompId => {
                if (selectedIds.includes(incompId)) {
                    const conflictIng = STAR_INGREDIENTS.find(i => i.id === incompId);
                    if (conflictIng) {
                        acc.push({ a: ing.name, b: conflictIng.name });
                    }
                }
            });
        }
        return acc;
    }, [] as { a: string; b: string }[]);

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
                核心成分
                <span className="ml-2 text-xs text-slate-400 font-normal">(从标准成分库选择)</span>
            </label>

            {/* Selected Chips */}
            <div className="flex flex-wrap gap-2 min-h-[32px]">
                {selectedIngredients.map((ing) => {
                    const cat = INGREDIENT_CATEGORIES[ing.category];
                    return (
                        <div
                            key={ing.id}
                            className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium border transition-all"
                            style={{
                                backgroundColor: `${cat.color}10`,
                                borderColor: `${cat.color}30`,
                                color: cat.color
                            }}
                        >
                            <span>{ing.name}</span>
                            <button
                                onClick={() => handleRemove(ing.id)}
                                className="p-0.5 rounded-full hover:bg-black/10 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}

                {/* Add Button */}
                <div ref={dropdownRef} className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(!isOpen);
                            setTimeout(() => inputRef.current?.focus(), 100);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        添加成分
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                        <div className="absolute z-50 top-full mt-2 left-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Search Input */}
                            <div className="p-3 border-b border-slate-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="搜索成分名或功效..."
                                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Results List */}
                            <div className="max-h-64 overflow-y-auto p-2">
                                {filteredIngredients.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400 text-sm">
                                        未找到匹配成分
                                    </div>
                                ) : (
                                    filteredIngredients.map((ing) => {
                                        const cat = INGREDIENT_CATEGORIES[ing.category];
                                        return (
                                            <button
                                                key={ing.id}
                                                type="button"
                                                onClick={() => handleSelect(ing.id)}
                                                className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                                    style={{ backgroundColor: `${cat.color}15` }}
                                                >
                                                    <Sparkles
                                                        className="w-4 h-4"
                                                        style={{ color: cat.color }}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-slate-900">{ing.name}</span>
                                                        <span className="text-xs text-slate-400">{ing.nameEn}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                                                        {ing.effects.slice(0, 3).join(' • ')}
                                                    </div>
                                                </div>
                                                <Plus className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 mt-2" />
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Conflict Warning */}
            {conflicts.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-medium">成分冲突提醒：</span>
                        {conflicts.map((c, i) => (
                            <span key={i}>
                                {c.a} 与 {c.b} 不建议同时使用
                                {i < conflicts.length - 1 ? '；' : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

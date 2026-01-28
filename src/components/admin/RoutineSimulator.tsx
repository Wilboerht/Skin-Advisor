"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Sun, Moon, AlertCircle } from "lucide-react";

interface RoutineSimulatorProps {
    currentStep: string;
    productName: string;
    productType: 'morning' | 'night' | 'both'; // We might infer this later
}

const ROUTINE_STEPS = [
    { id: 'cleanser', label: 'Cleanser', icon: '🧖‍♀️' },
    { id: 'toner', label: 'Toner', icon: '💧' },
    { id: 'essence', label: 'Essence', icon: '✨' },
    { id: 'serum', label: 'Serum', icon: '🧪' },
    { id: 'eye_cream', label: 'Eye Cream', icon: '👁️' },
    { id: 'cream', label: 'Moisturizer', icon: '🧴' },
    { id: 'oil', label: 'Face Oil', icon: '🫒' },
    { id: 'sunscreen', label: 'Sunscreen', icon: '☀️' },
];

export function RoutineSimulator({ currentStep, productName }: RoutineSimulatorProps) {
    // Locate the index of the current step
    const stepIndex = ROUTINE_STEPS.findIndex(s => s.id === currentStep);

    // Determine context (simplified logic)
    const isCleansing = ['cleanser', 'mask'].includes(currentStep);
    const isTreatment = ['toner', 'essence', 'serum', 'oil'].includes(currentStep);
    const isProtection = ['cream', 'sunscreen'].includes(currentStep);

    return (
        <div className="rounded-xl border border-[#1A1A1A]/10 bg-[#FDFBF7] p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-serif font-bold text-[#1A1A1A]">Routine Context Simulator</h3>
                <div className="flex gap-2 text-xs text-[#1A1A1A]/40">
                    <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> AM</span>
                    <span className="flex items-center gap-1"><Moon className="w-3 h-3" /> PM</span>
                </div>
            </div>

            <div className="relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[#1A1A1A]/5 -translate-y-1/2 z-0"></div>

                <div className="relative z-10 flex justify-between items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {ROUTINE_STEPS.map((step, index) => {
                        const isActive = step.id === currentStep;
                        const isPast = stepIndex !== -1 && index < stepIndex;

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2 min-w-[60px] group">
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all duration-300",
                                        isActive
                                            ? "bg-[#3D4430] border-[#3D4430] text-white scale-110 shadow-lg"
                                            : isPast
                                                ? "bg-[#1A1A1A]/5 border-[#1A1A1A]/10 text-gray-400 grayscale"
                                                : "bg-white border-dashed border-[#1A1A1A]/20 text-gray-300"
                                    )}
                                >
                                    {step.icon}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-medium uppercase tracking-wider text-center transition-colors",
                                    isActive ? "text-[#3D4430]" : "text-[#1A1A1A]/30"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {currentStep && stepIndex !== -1 ? (
                <div className="bg-white rounded-lg p-3 border border-[#1A1A1A]/5 text-xs text-[#1A1A1A]/60 flex items-start gap-3">
                    <div className="w-1 h-full min-h-[40px] rounded-full bg-[#C19F70]"></div>
                    <div>
                        <p className="font-medium text-[#1A1A1A] mb-1">Application Guide</p>
                        <p>
                            Apply <strong>{productName || "this product"}</strong>
                            {stepIndex > 0 ? ` after ${ROUTINE_STEPS[stepIndex - 1].label}` : ' as the first step'}
                            {stepIndex < ROUTINE_STEPS.length - 1 ? ` and before ${ROUTINE_STEPS[stepIndex + 1].label}` : ' as the final step'}
                            .
                        </p>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-xs text-[#1A1A1A]/30 italic border border-dashed border-[#1A1A1A]/10 rounded-lg">
                    Select a "Skincare Step" above to see routine placement.
                </div>
            )}
        </div>
    );
}

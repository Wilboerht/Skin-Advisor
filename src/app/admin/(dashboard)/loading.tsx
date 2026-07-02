import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-[#C9A86C] animate-spin" />
            <p className="text-sm font-medium text-[#8B7355]">加载中...</p>
        </div>
    );
}

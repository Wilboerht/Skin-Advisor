"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export function SetupButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const toast = useToast();

    const handleSetup = async () => {
        // Simple confirmation before running
        if (!confirm("This will populate the database with standard skincare products. Continue?")) return;

        setLoading(true);
        try {
            const res = await fetch("/api/admin/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Catalog initialized successfully!");
                // Refresh the page to update the dashboard stats and hide the prompt
                router.refresh();
            } else {
                toast.error("Setup failed: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            // Silent fail: toast already shown
            toast.error("Network error during setup");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSetup}
            disabled={loading}
            className="rounded-full bg-[#1A1A1A] px-6 py-3 text-xs font-bold tracking-widest text-white hover:bg-[#3D4430] transition-all uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {loading ? "Initializing..." : "Run Setup / Seed Data"}
        </button>
    );
}

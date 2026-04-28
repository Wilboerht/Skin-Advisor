"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, ChevronDown, ChevronUp, Sparkles, Loader2, X, LogIn } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";

interface Message {
    id: string;
    role: "system" | "user" | "assistant";
    content: string;
    createdAt: number;
}


interface AIChatWindowProps {
    skinType?: string;
    concerns?: string[];
    summary?: string;
    sessionId?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AIChatWindow({ skinType, concerns, summary, sessionId, open: controlledOpen, onOpenChange }: AIChatWindowProps) {
    const { user } = useAuth();
    const { openAuthModal } = useAuthModal();
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = (value: boolean) => {
        if (controlledOpen === undefined) setInternalOpen(value);
        onOpenChange?.(value);
    };
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `您好！我是您的专属 AI 护肤顾问。基于您的肤质分析报告，您有什么想进一步了解的吗？比如："适合我的防晒霜怎么选？"或"如何改善T区出油？"`,
            createdAt: 0 // Avoids SSR/CSR hydration mismatch; actual timestamp not displayed for welcome msg
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasLoadedHistory = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // Load history (only for logged-in users)
    useEffect(() => {
        if (isOpen && sessionId && user && !hasLoadedHistory.current) {
            hasLoadedHistory.current = true;
            fetch(`/api/advisor/chat?sessionId=${sessionId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.history && data.history.length > 0) {
                        const formattedHistory = data.history.map((m: any) => ({
                            id: m.id,
                            role: m.role,
                            content: m.content,
                            createdAt: new Date(m.createdAt).getTime()
                        }));
                        setMessages(formattedHistory);
                    }
                })
                .catch(err => console.error("Failed to load chat history", err));
        }
    }, [isOpen, sessionId, user]);

    // Handle open (called from external trigger button)
    const handleOpen = () => {
        if (!user) {
            openAuthModal('login');
            return;
        }
        setIsOpen(true);
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userText = inputValue.trim();
        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: userText,
            createdAt: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);

        const tempId = (Date.now() + 1).toString();
        // Add placeholder assistant message
        setMessages(prev => [...prev, {
            id: tempId,
            role: "assistant",
            content: "",
            createdAt: Date.now()
        }]);

        try {
            const response = await fetch("/api/advisor/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userText,
                    sessionId: sessionId,
                    context: {
                        skinType: skinType,
                        concerns: concerns,
                        summary: summary
                    }
                })
            });

            if (!response.ok || !response.body) {
                throw new Error("Chat service unavailable");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;

                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, content: accumulatedText }
                        : msg
                ));
            }

        } catch (error) {
            console.error("Chat error:", error);
            // Replace loading message with error
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? { ...msg, role: "system", content: "网络连接异常，请稍后再试。" }
                    : msg
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <>
            {/* 聊天窗口 - 只有登录用户可以打开 */}
            <AnimatePresence>
                {isOpen && user && (
                    <m.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-4 right-4 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:bottom-8 sm:right-8 sm:w-[380px]"
                    >
                        {/* 顶部栏 */}
                        <div className="flex items-center justify-between bg-brand-charcoal px-4 py-3 text-white">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                                    <Sparkles className="h-4 w-4 text-brand-gold" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium">AI 顾问</h3>
                                    <p className="text-xs text-white/60">在线为您解答护肤疑问</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsOpen(false); onOpenChange?.(false); }}
                                className="rounded-full p-1 hover:bg-white/10"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* 消息列表 */}
                        <div className="flex-1 overflow-y-auto bg-stone-50 p-4">
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex w-full",
                                            msg.role === "user" ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                                msg.role === "user"
                                                    ? "bg-brand-charcoal text-white rounded-br-none"
                                                    : msg.role === "system"
                                                        ? "bg-red-50 text-red-500 text-xs text-center w-full"
                                                        : "bg-white text-stone-800 shadow-sm border border-stone-100 rounded-bl-none"
                                            )}
                                        >
                                            {/* Avatar or Icon if needed */}
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="flex items-center space-x-2 rounded-2xl rounded-bl-none bg-white px-4 py-3 shadow-sm border border-stone-100">
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 delay-75"></div>
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 delay-150"></div>
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 delay-300"></div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* 输入框 */}
                        <div className="border-t border-stone-100 bg-white p-3">
                            <div className="relative flex items-center">
                                <input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="问问 AI..."
                                    className="w-full rounded-full border border-stone-200 bg-stone-50 py-3 pl-4 pr-12 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-white transition-colors hover:bg-brand-gold/90 disabled:opacity-50"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </>
    );
}

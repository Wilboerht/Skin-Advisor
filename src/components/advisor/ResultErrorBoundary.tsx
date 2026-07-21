"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ResultErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error("Result page render error:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
                    <div className="text-center max-w-md">
                        <AlertCircle className="w-12 h-12 text-[#8c7a6b] mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-[#5c4937] mb-2">页面加载出错</h2>
                        <p className="text-sm text-[#8c7a6b] mb-6">
                            抱歉，报告页面渲染时发生错误。请尝试刷新页面或返回首页重新测试。
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5c4937] px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-[#4a3a2c] transition-colors"
                        >
                            返回首页
                        </Link>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

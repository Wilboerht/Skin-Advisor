"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface Props {
    children: ReactNode;
    resetKeys?: (string | number | null | undefined)[];
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ResultErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Result page render error:", error, errorInfo);
    }

    resetErrorBoundary = () => {
        this.props.onReset?.();
        this.setState({ hasError: false, error: undefined });
    };

    componentDidUpdate(prevProps: Props) {
        const { resetKeys } = this.props;
        if (
            this.state.hasError &&
            resetKeys &&
            resetKeys !== prevProps.resetKeys &&
            resetKeys.some((key, i) => key !== prevProps.resetKeys?.[i])
        ) {
            this.resetErrorBoundary();
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
                    <div className="text-center max-w-md">
                        <AlertCircle className="w-12 h-12 text-[#8c7a6b] mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-[#5c4937] mb-2">报告页面出现了问题</h2>
                        <p className="text-sm text-[#8c7a6b] mb-6">
                            报告页面暂时无法显示。请重试或返回首页重新开始。
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={this.resetErrorBoundary}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5c4937] px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-[#4a3a2c] transition-colors"
                            >
                                重试
                            </button>
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#5c4937]/30 bg-white px-6 py-3 text-sm font-medium text-[#5c4937] hover:bg-[#5c4937]/5 transition-colors"
                            >
                                返回首页
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

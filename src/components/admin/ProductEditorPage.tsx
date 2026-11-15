"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import ProductForm from "./ProductForm";
import type { ProductFormData } from "@/types/product";

interface ProductEditorPageProps {
    product: ProductFormData;
    returnTo: string;
}

export default function ProductEditorPage({
    product,
    returnTo,
}: ProductEditorPageProps) {
    const router = useRouter();
    const [dirty, setDirty] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const leave = useCallback(() => {
        router.push(returnTo);
        router.refresh();
    }, [returnTo, router]);

    const handleCancel = useCallback(() => {
        if (dirty) {
            setConfirmDiscard(true);
            return;
        }
        leave();
    }, [dirty, leave]);

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="编辑产品"
                description="产品基础信息由主站同步，子站维护推荐属性、上下架与精选"
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        leftIcon={<ArrowLeft className="h-4 w-4" />}
                    >
                        返回列表
                    </Button>
                }
            />

            <div className="mx-auto w-full max-w-4xl">
                <ProductForm
                    key={product.id}
                    initialData={product}
                    onSuccess={leave}
                    onCancel={handleCancel}
                    onSubmittingChange={setSubmitting}
                    onDirtyChange={setDirty}
                />
            </div>

            <ConfirmModal
                isOpen={confirmDiscard}
                onClose={() => setConfirmDiscard(false)}
                onConfirm={() => {
                    setConfirmDiscard(false);
                    leave();
                }}
                title="放弃未保存的修改"
                message="当前修改尚未保存，确定要离开吗？"
                confirmText="放弃修改"
                cancelText="继续编辑"
                variant="warning"
                loading={submitting}
            />
        </div>
    );
}

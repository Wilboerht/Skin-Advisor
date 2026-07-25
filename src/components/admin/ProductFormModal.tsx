"use client";

import { useState, useCallback } from "react";
import { Package } from "lucide-react";
import ProductForm, { ProductFormData } from "./ProductForm";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminModal } from "@/components/ui/AdminModal";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductFormData | null;
  onSuccess?: () => void;
}

export function ProductFormModal({ isOpen, onClose, product, onSuccess }: ProductFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleClose = useCallback(() => {
    if (submitting) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [submitting, isDirty, onClose]);

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  return (
    <>
      <AdminModal
        isOpen={isOpen}
        onClose={handleClose}
        title={product ? "编辑产品" : "新建产品"}
        titleId="product-form-modal-title"
        subtitle={product ? "修改产品信息" : "填写产品信息并发布到前端展示"}
        maxWidth="4xl"
        disabled={submitting}
        headerIcon={
          <div className="w-10 h-10 rounded-xl bg-[#C9A86C]/15 flex items-center justify-center">
            <Package className="w-5 h-5 text-[#8B6914]" />
          </div>
        }
      >
        <ProductForm
          key={product?.id || "new"}
          initialData={product}
          onSuccess={handleSuccess}
          onCancel={handleClose}
          onSubmittingChange={setSubmitting}
          onDirtyChange={setIsDirty}
        />
      </AdminModal>

      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
        title="放弃更改？"
        message="您有未保存的更改，确定要关闭吗？"
        confirmText="放弃更改"
        variant="warning"
      />
    </>
  );
}

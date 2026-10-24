import Link from "next/link";
import { PackageX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PanelCard } from "@/components/admin/PanelCard";

export default function ProductsNotFound() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <PanelCard className="w-full max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-charcoal/[0.04] text-brand-charcoal/65">
                    <PackageX className="h-7 w-7" />
                </div>
                <h2 className="text-base font-medium text-brand-charcoal">
                    页面未找到
                </h2>
                <p className="mt-1 text-sm text-brand-charcoal/65">
                    请求的产品页面不存在或已被移除。
                </p>
                <div className="mt-5 flex justify-center">
                    <Link href="/admin/products">
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<ArrowLeft className="h-4 w-4" />}
                        >
                            返回产品列表
                        </Button>
                    </Link>
                </div>
            </PanelCard>
        </div>
    );
}

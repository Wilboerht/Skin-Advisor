export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-canvas">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-brand-bronze border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[13px] text-brand-ink-muted font-light tracking-wide">加载中...</p>
      </div>
    </div>
  );
}

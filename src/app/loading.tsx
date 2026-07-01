export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8F7F3]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#8B7355] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[13px] text-[#5E5E5E] font-light tracking-wide">加载中...</p>
      </div>
    </div>
  );
}

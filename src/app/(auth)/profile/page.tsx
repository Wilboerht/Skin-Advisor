import ProfileClient from "./ProfileClient";

// 未登录也可访问：ProfileClient 渲染占位预览 + 登录引导（资料/记录 API 仍由服务端鉴权保护）
export default async function ProfilePage() {
    return <ProfileClient />;
}

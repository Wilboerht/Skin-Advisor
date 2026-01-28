/**
 * Supabase 客户端配置
 * 用于 Storage 等 Supabase 服务
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 单例模式
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Supabase 未配置，部分功能不可用");
        return null;
    }

    if (!supabaseClient) {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }

    return supabaseClient;
}

// 检查 Supabase 是否已配置
export function isSupabaseConfigured(): boolean {
    return !!(supabaseUrl && supabaseAnonKey);
}

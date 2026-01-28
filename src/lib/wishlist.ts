/**
 * 心愿单功能
 * 支持 localStorage (游客) + 数据库 (已登录用户)
 */

const WISHLIST_STORAGE_KEY = 'myskin_wishlist';
const GUEST_ID_KEY = 'myskin_guest_id';

export interface WishlistItem {
    productId: string;
    addedAt: string; // ISO date string
    note?: string;
}

export interface LocalWishlist {
    items: WishlistItem[];
    updatedAt: string;
}

// ===== 游客 ID 管理 =====

function generateGuestId(): string {
    return 'guest_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function getGuestId(): string {
    if (typeof window === 'undefined') return '';

    let guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
        guestId = generateGuestId();
        localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
}

// ===== 本地存储操作 =====

function getLocalWishlist(): LocalWishlist {
    if (typeof window === 'undefined') {
        return { items: [], updatedAt: new Date().toISOString() };
    }

    try {
        const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored) as LocalWishlist;
        }
    } catch (e) {
        console.error('Failed to parse wishlist from localStorage:', e);
    }

    return { items: [], updatedAt: new Date().toISOString() };
}

function saveLocalWishlist(wishlist: LocalWishlist): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch (e) {
        console.error('Failed to save wishlist to localStorage:', e);
    }
}

// ===== 公共 API =====

/**
 * 获取心愿单产品ID列表 (本地)
 */
export function getWishlistProductIds(): string[] {
    return getLocalWishlist().items.map(item => item.productId);
}

/**
 * 检查产品是否在心愿单中
 */
export function isInWishlist(productId: string): boolean {
    return getWishlistProductIds().includes(productId);
}

/**
 * 添加产品到心愿单 (本地)
 */
export function addToWishlist(productId: string, note?: string): void {
    const wishlist = getLocalWishlist();

    // 检查是否已存在
    if (wishlist.items.some(item => item.productId === productId)) {
        return;
    }

    wishlist.items.push({
        productId,
        addedAt: new Date().toISOString(),
        note
    });
    wishlist.updatedAt = new Date().toISOString();

    saveLocalWishlist(wishlist);

    // 触发自定义事件，通知 UI 更新
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wishlist-updated', {
            detail: { action: 'add', productId }
        }));
    }
}

/**
 * 从心愿单移除产品 (本地)
 */
export function removeFromWishlist(productId: string): void {
    const wishlist = getLocalWishlist();
    wishlist.items = wishlist.items.filter(item => item.productId !== productId);
    wishlist.updatedAt = new Date().toISOString();

    saveLocalWishlist(wishlist);

    // 触发自定义事件
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wishlist-updated', {
            detail: { action: 'remove', productId }
        }));
    }
}

/**
 * 切换心愿单状态
 */
export function toggleWishlist(productId: string): boolean {
    if (isInWishlist(productId)) {
        removeFromWishlist(productId);
        return false;
    } else {
        addToWishlist(productId);
        return true;
    }
}

/**
 * 获取心愿单数量
 */
export function getWishlistCount(): number {
    return getLocalWishlist().items.length;
}

/**
 * 清空心愿单
 */
export function clearWishlist(): void {
    saveLocalWishlist({ items: [], updatedAt: new Date().toISOString() });

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wishlist-updated', {
            detail: { action: 'clear' }
        }));
    }
}

// ===== 服务端同步 API =====

interface SyncWishlistParams {
    userId?: string;
    guestId?: string;
}

/**
 * 同步心愿单到服务器 (用于登录后合并)
 */
export async function syncWishlistToServer(params: SyncWishlistParams): Promise<void> {
    const localWishlist = getLocalWishlist();

    if (localWishlist.items.length === 0) return;

    try {
        await fetch('/api/wishlist/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                items: localWishlist.items
            })
        });
    } catch (e) {
        console.error('Failed to sync wishlist:', e);
    }
}

/**
 * 从服务器拉取心愿单
 */
export async function fetchWishlistFromServer(params: SyncWishlistParams): Promise<WishlistItem[]> {
    try {
        const queryParams = new URLSearchParams();
        if (params.userId) queryParams.set('userId', params.userId);
        if (params.guestId) queryParams.set('guestId', params.guestId);

        const response = await fetch(`/api/wishlist?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch wishlist');

        const data = await response.json();
        return data.items || [];
    } catch (e) {
        console.error('Failed to fetch wishlist from server:', e);
        return [];
    }
}

/**
 * 合并本地和服务器心愿单
 */
export function mergeWishlists(local: WishlistItem[], remote: WishlistItem[]): WishlistItem[] {
    const merged = new Map<string, WishlistItem>();

    // 先添加远程数据
    remote.forEach(item => merged.set(item.productId, item));

    // 本地数据覆盖（保留最新的 addedAt）
    local.forEach(item => {
        const existing = merged.get(item.productId);
        if (!existing || new Date(item.addedAt) > new Date(existing.addedAt)) {
            merged.set(item.productId, item);
        }
    });

    return Array.from(merged.values());
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/wishlist/sync - 同步心愿单 (登录后合并)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, guestId, items } = body;

        if (!userId && !guestId) {
            return NextResponse.json({ error: 'userId or guestId is required' }, { status: 400 });
        }

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'items array is required' }, { status: 400 });
        }

        // 查找或创建心愿单
        let wishlist = await prisma.wishlist.findFirst({
            where: userId ? { userId } : { guestId }
        });

        if (!wishlist) {
            wishlist = await prisma.wishlist.create({
                data: {
                    userId: userId || null,
                    guestId: guestId || null
                }
            });
        }

        // 批量添加/更新项目
        const results = await Promise.allSettled(
            items.map(async (item: { productId: string; addedAt?: string; note?: string }) => {
                // 检查产品是否存在
                const product = await prisma.product.findUnique({
                    where: { id: item.productId }
                });

                if (!product) {
                    return { productId: item.productId, status: 'skipped', reason: 'product not found' };
                }

                // 创建或更新
                const existing = await prisma.wishlistItem.findUnique({
                    where: {
                        wishlistId_productId: {
                            wishlistId: wishlist.id,
                            productId: item.productId
                        }
                    }
                });

                if (existing) {
                    // 如果本地的 addedAt 更新，则更新备注
                    if (item.note && item.note !== existing.note) {
                        await prisma.wishlistItem.update({
                            where: { id: existing.id },
                            data: { note: item.note }
                        });
                    }
                    return { productId: item.productId, status: 'exists' };
                }

                // 新增
                await prisma.wishlistItem.create({
                    data: {
                        wishlistId: wishlist.id,
                        productId: item.productId,
                        note: item.note,
                        addedAt: item.addedAt ? new Date(item.addedAt) : new Date()
                    }
                });

                return { productId: item.productId, status: 'added' };
            })
        );

        // 如果是登录用户同步，考虑合并游客心愿单
        if (userId && guestId) {
            const guestWishlist = await prisma.wishlist.findFirst({
                where: { guestId },
                include: { items: true }
            });

            if (guestWishlist && guestWishlist.items.length > 0) {
                // 合并游客心愿单到用户心愿单
                for (const guestItem of guestWishlist.items) {
                    const exists = await prisma.wishlistItem.findUnique({
                        where: {
                            wishlistId_productId: {
                                wishlistId: wishlist.id,
                                productId: guestItem.productId
                            }
                        }
                    });

                    if (!exists) {
                        await prisma.wishlistItem.create({
                            data: {
                                wishlistId: wishlist.id,
                                productId: guestItem.productId,
                                note: guestItem.note,
                                addedAt: guestItem.addedAt
                            }
                        });
                    }
                }

                // 删除游客心愿单
                await prisma.wishlist.delete({
                    where: { id: guestWishlist.id }
                });
            }
        }

        return NextResponse.json({
            message: 'Sync completed',
            results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error' })
        });
    } catch (error) {
        console.error('Sync wishlist error:', error);
        return NextResponse.json({ error: 'Failed to sync wishlist' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/wishlist - 获取心愿单
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const guestId = searchParams.get('guestId');

        if (!userId && !guestId) {
            return NextResponse.json({ items: [] });
        }

        const wishlist = await prisma.wishlist.findFirst({
            where: userId ? { userId } : { guestId },
            include: {
                items: {
                    include: {
                        product: true
                    },
                    orderBy: {
                        addedAt: 'desc'
                    }
                }
            }
        });

        if (!wishlist) {
            return NextResponse.json({ items: [] });
        }

        return NextResponse.json({
            id: wishlist.id,
            items: wishlist.items.map(item => ({
                productId: item.productId,
                addedAt: item.addedAt.toISOString(),
                note: item.note,
                product: item.product
            }))
        });
    } catch (error) {
        console.error('Get wishlist error:', error);
        return NextResponse.json({ error: 'Failed to get wishlist' }, { status: 500 });
    }
}

// POST /api/wishlist - 添加到心愿单
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productId, userId, guestId, note } = body;

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        if (!userId && !guestId) {
            return NextResponse.json({ error: 'userId or guestId is required' }, { status: 400 });
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

        // 检查产品是否已存在
        const existingItem = await prisma.wishlistItem.findUnique({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId
                }
            }
        });

        if (existingItem) {
            return NextResponse.json({
                message: 'Product already in wishlist',
                item: existingItem
            });
        }

        // 添加新项目
        const newItem = await prisma.wishlistItem.create({
            data: {
                wishlistId: wishlist.id,
                productId,
                note
            },
            include: {
                product: true
            }
        });

        return NextResponse.json({
            message: 'Added to wishlist',
            item: {
                productId: newItem.productId,
                addedAt: newItem.addedAt.toISOString(),
                note: newItem.note,
                product: newItem.product
            }
        });
    } catch (error) {
        console.error('Add to wishlist error:', error);
        return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
    }
}

// DELETE /api/wishlist - 从心愿单移除
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const userId = searchParams.get('userId');
        const guestId = searchParams.get('guestId');

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        if (!userId && !guestId) {
            return NextResponse.json({ error: 'userId or guestId is required' }, { status: 400 });
        }

        // 查找心愿单
        const wishlist = await prisma.wishlist.findFirst({
            where: userId ? { userId } : { guestId }
        });

        if (!wishlist) {
            return NextResponse.json({ message: 'Wishlist not found' });
        }

        // 删除项目
        await prisma.wishlistItem.deleteMany({
            where: {
                wishlistId: wishlist.id,
                productId
            }
        });

        return NextResponse.json({ message: 'Removed from wishlist' });
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
    }
}

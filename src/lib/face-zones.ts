/**
 * MediaPipe Face Mesh 区域映射与数据处理引擎 (最高精度版)
 *
 * 功能：
 * 1. VERTEX_ZONE_MAP: 定义 478 个顶点分别属于哪个皮肤区域 (Forehead, Cheek, etc.)
 * 2. buildTrianglesFromConnections: 从边列表重建三角形拓扑
 * 3. getTriangleZone: 判定三角形所属区域
 * 4. getZoneScore: 按维度提取评分
 * 5. scoreToColor: 高级 HSL 颜色插值引擎
 */

import type { ZoneData } from "./advisor-utils";

// ============================================================================
// 1. 类型定义
// ============================================================================

export type ZoneKey = "forehead" | "tZone" | "leftCheek" | "rightCheek" | "eyeArea" | "jawline";

export type DimensionKey = "overall" | "oil" | "pores" | "wrinkles" | "spots" | "acne" | "darkCircles";

// ============================================================================
// 2. 顶点 -> 区域映射表 (MediaPipe 478点拓扑)
// ============================================================================

/**
 * 顶点的区域归属表 (Index -> ZoneKey | null)
 * 支持 478 个点 (468 标准 + 10 虹膜)
 * null 表示该点位于边界或非核心区域（如嘴唇内部、眼球表面），不参与热力渲染
 */
const VERTEX_ZONE_MAP: (ZoneKey | null)[] = new Array(478).fill(null);

/**
 * 初始化区域映射 (基于 MediaPipe 官方拓扑)
 * 注意：这是一份精简后的关键区域映射，确保热力图只覆盖皮肤核心区
 */
function initVertexMap() {
    // -------------------------------------------------------------------------
    // 额头 (Forehead) - 眉毛以上
    // -------------------------------------------------------------------------
    // 包含：发际线、眉上、额头中部、太阳穴附近
    const foreheadIndices = [
        10, 338, 297, 332, 284, 251, 389, 356,
        54, 103, 67, 109,
        // 增补密集点 (Upper Forehead & Temples)
        8, 9, 63, 105, 66, 107, 55, 193, 245, 124, 46, 53, 52, 65,
        333, 296, 334, 293, 300, 298, 284, 332, 297, 338,
        151, 156, 173, 133, 155, 139, 153, 154, 33, 7, 163, 144, 145, 153, 154, 155, 133,
        // Mid Forehead
        68, 69, 70, 71, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356
    ];
    // 填充更密集的内部点
    const foreheadDense = [
        103, 104, 105, 66, 67, 68, 69, 108, 109, 10, 338, 297, 332, 284, 251, 389, 356,
        397, 365, 379, 378, 400, 377,
        // 更多填充
        1, 2, 94, 19, 168, 6, 197, 195, 5, 4, 75, 97, 2, 326, 327, 294, 278, 279, 360, 344, 438, 237
    ];

    const allForehead = [...new Set([...foreheadIndices, ...foreheadDense])];
    // 过滤掉属于 T 区的点 (眉心部分后续会覆盖，但先赋 Forehead 也没问题，只要顺序正确)
    allForehead.forEach(idx => VERTEX_ZONE_MAP[idx] = "forehead");


    // -------------------------------------------------------------------------
    // T区 (T-Zone) - 眉心 + 鼻梁 + 鼻翼
    // -------------------------------------------------------------------------
    const tZoneIndices = [
        // 眉心 (Glabella)
        9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 248, 249, 250, 468, 473,
        // 鼻梁 (Nose Bridge)
        164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 151,
        // 鼻翼与鼻尖 (Nose Tip & Ala)
        218, 438, 219, 439, 237, 457, 44, 274, 19, 235, 236, 134, 198, 49, 131, 240,
        64, 239, 238, 241, 242, 20, 79, 166, 218, 438, 458, 459, 275, 440, 363, 456
    ];
    tZoneIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "tZone");

    // -------------------------------------------------------------------------
    // 左脸颊 (Left Cheek) - 颧骨到下颌上方
    // -------------------------------------------------------------------------
    const leftCheekIndices = [
        // 核心区
        117, 111, 118, 119, 120, 121, 128, 186, 203, 205, 206, 207, 187, 147, 92, 165,
        // 颧骨 (Zygomatic) - 修正：移除 428 (右脸点)
        123, 117, 116, 123, 147, 213, 192, 214, 210, 211, 32, 208, 199, 199,
        // 补充密集点
        234, 227, 132, 58, 172, 136, 150, 149, 176, 148,
        // 鼻唇沟 (Nasolabial Left)
        226, 31, 228, 229, 230, 231, 232, 233, 139, 156, 70, 63, 105, 66, 107
    ];
    // 扩展填充 (Dense Fill)
    const cheekDense = [
        227, 116, 117, 118, 119, 120, 121, 128, 47, 100, 142, 203, 206, 216,
        192, 213, 138, 135, 169, 170, 140, 171, 175, 199, 208, 32, 204,
        123, 50, 101, 100, 212, 214, 210, 211, 202, 215, 135, 139,
        // 更多内部填充
        57, 186, 92, 165, 167, 164, 93, 132, 215, 58, 172, 136, 135
    ];

    // 过滤掉右脸的点
    const allLeftCheek = [...new Set([...leftCheekIndices, ...cheekDense])]
        .filter(i => ![266, 371, 355].includes(i)); // 移除残留干扰点

    allLeftCheek.forEach(idx => VERTEX_ZONE_MAP[idx] = "leftCheek");


    // -------------------------------------------------------------------------
    // 右脸颊 (Right Cheek)
    // -------------------------------------------------------------------------
    const rightCheekDense = [
        // 核心区
        416, 433, 364, 367, 394, 395, 369, 396, 422, 428, 262, 424,
        // 颧骨 (Zygomatic Right)
        352, 345, 346, 347, 348, 349, 350, 357, 371, 280, 423, 426, 427, 432,
        434, 430, 431, 262, 425,
        // 鼻唇沟 (Nasolabial Right)
        446, 261, 448, 449, 450, 451, 452, 453, 364, 393, 305, 309, 335, 429,
        // 补充密集点
        454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
        // 更多内部填充
        277, 329, 343, 391, 322, 410, 280, 425, 427, 426
    ];

    // 移除潜在的左侧/中线点
    const allRightCheek = [...new Set(rightCheekDense)];
    allRightCheek.forEach(idx => VERTEX_ZONE_MAP[idx] = "rightCheek");

    // -------------------------------------------------------------------------
    // 眼周 (Eye Area)
    // -------------------------------------------------------------------------
    const eyeAreaIndices = [
        // 左眼周 (上下眼睑 + 鱼尾纹区)
        226, 247, 30, 29, 27, 28, 56, 190, 243, 25, 110, 24, 23, 22, 26, 112, 244,
        228, 229, 230, 231, 232, 233, 245, 130, 133, 173, 157, 158, 159, 160, 161, 246,
        133, 7, 33, 163, 144, 145, 153, 154, 155,
        // 右眼周
        463, 414, 286, 258, 257, 259, 260, 467, 359, 255, 339, 254, 253, 252, 256, 341, 464,
        448, 449, 450, 451, 452, 453, 465, 362, 398, 384, 385, 386, 387, 388, 466,
        263, 362, 382, 381, 380, 374, 373, 390, 249
    ];
    eyeAreaIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "eyeArea");

    // -------------------------------------------------------------------------
    // 下颌 (Jawline) - 下巴边缘 U 型区
    // -------------------------------------------------------------------------
    const jawlineIndices = [
        // 边缘轮廓
        152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
        377, 400, 378, 379, 365, 397, 288, 361, 323, 454,
        // 补充下巴区域 (Mentum)
        18, 200, 199, 175, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
        14, 15, 16, 17, 314, 17, 84, 181, 91, 106, 182, 83, 18,
        // 下唇下方
        87, 178, 88, 95, 324, 318, 402, 317, 14, 87,
        176, 148, 152, 377, 400, 378,
        // 侧颌 (Jaw Body)
        132, 215, 58, 138, 172, 136, 150, 149, 176, 148, 152,
        377, 400, 378, 379, 365, 397, 288, 361, 323, 454
    ];

    // 合并下颌并去重
    const allJawline = [...new Set(jawlineIndices)];

    // 最后赋值：下颌会覆盖部分脸颊边缘，这通常是期望的 (轮廓优先)
    // 但要避开 T 区的鼻子部分
    allJawline.forEach(idx => {
        // 防止覆盖鼻子
        const noseIndices = [1, 4, 19, 94, 2, 49, 131, 134, 5, 275, 456, 363, 6, 197, 168, 8, 9];
        if (!noseIndices.includes(idx)) {
            VERTEX_ZONE_MAP[idx] = "jawline";
        }
    });
}

// 执行初始化
initVertexMap();

// 优化标记
let isMapRefined = false;


// ============================================================================
// 3. 三角形重建算法与缓存
// ============================================================================

/** 三角形缓存 */
let cachedTriangles: [number, number, number][] | null = null;

// MediaPipe 的连接类型
export type Connection = { start: number; end: number };

/**
 * 基于拓扑连接自动填充 VertexMap 的空洞 (Auto-Hole Filling)
 * 提升热力图的覆盖率，消除未定义区域
 */
export function refineVertexMap(connections: Connection[]) {
    if (isMapRefined) return;

    console.time("refineVertexMap");

    // 1. 构建邻接表
    const adjacency = new Map<number, number[]>();
    connections.forEach(({ start, end }) => {
        if (!adjacency.has(start)) adjacency.set(start, []);
        if (!adjacency.has(end)) adjacency.set(end, []);
        adjacency.get(start)!.push(end);
        adjacency.get(end)!.push(start);
    });

    // 2. 迭代填充 (2轮迭代足以覆盖大多数单点空洞)
    // 逻辑：如果一个点的邻居主要是 Zone X，则该点也归属 Zone X
    for (let pass = 0; pass < 2; pass++) {
        const updates = new Map<number, ZoneKey>();

        for (let i = 0; i < 478; i++) {
            // 只处理当前未定义的点
            if (VERTEX_ZONE_MAP[i] !== null) continue;

            const neighbors = adjacency.get(i);
            if (!neighbors || neighbors.length === 0) continue;

            // 统计邻居的区域归属
            const voteCounts: Record<string, number> = {};
            let validVotes = 0;

            neighbors.forEach(n => {
                const z = VERTEX_ZONE_MAP[n];
                if (z) {
                    voteCounts[z] = (voteCounts[z] || 0) + 1;
                    validVotes++;
                }
            });

            // 如果有有效邻居投票
            if (validVotes > 0) {
                // 寻找票数最多的区域
                let bestZone: ZoneKey | null = null;
                let maxCount = 0;

                for (const [zone, count] of Object.entries(voteCounts)) {
                    // 简单的多数原则
                    if (count > maxCount) {
                        maxCount = count;
                        bestZone = zone as ZoneKey;
                    }
                }

                if (bestZone) {
                    updates.set(i, bestZone);
                }
            }
        }

        // 应用本轮更新
        if (updates.size === 0) break;
        updates.forEach((zone, idx) => {
            VERTEX_ZONE_MAP[idx] = zone;
        });

        console.log(`[FaceZones] Pass ${pass + 1}: Filled ${updates.size} gaps.`);
    }

    isMapRefined = true;
    console.timeEnd("refineVertexMap");
}

/**
 * 重建三角形列表 (最高精度，~900 - 1000 个三角形)
 * 算法：遍历所有连接，寻找构成三角形的三元环 (A-B, B-C, C-A)
 * 优化：预先建立邻接表，加速查找
 */
export function buildMeshTriangles(connections: Connection[]): [number, number, number][] {
    if (cachedTriangles) return cachedTriangles;

    console.time("buildMeshTriangles");

    // 1. 构建邻接表: Vertex -> Set<NeighborVertex>
    const adjacency = new Map<number, Set<number>>();

    // 添加边的辅助函数
    const addEdge = (u: number, v: number) => {
        if (!adjacency.has(u)) adjacency.set(u, new Set());
        if (!adjacency.has(v)) adjacency.set(v, new Set());
        adjacency.get(u)!.add(v);
        adjacency.get(v)!.add(u);
    };

    connections.forEach(conn => addEdge(conn.start, conn.end));

    // 2. 查找三角形
    // 遍历每条边 (u, v)，查找是否存在 w，使得 (u, w) 和 (v, w) 都在邻接表中
    // 为避免重复，要求索引顺序 u < v < w
    const triangles: [number, number, number][] = [];

    connections.forEach(conn => {
        const u = Math.min(conn.start, conn.end);
        const v = Math.max(conn.start, conn.end);

        const neighborsU = adjacency.get(u);
        const neighborsV = adjacency.get(v);

        if (!neighborsU || !neighborsV) return;

        // 找两个顶点的共同邻居 w
        neighborsU.forEach(w => {
            if (w > v && neighborsV.has(w)) { // 保证 u < v < w 唯一性
                triangles.push([u, v, w]);
            }
        });
    });

    console.timeEnd("buildMeshTriangles");
    console.log(`[FaceZones] Rebuilt ${triangles.length} mesh triangles.`);

    cachedTriangles = triangles;
    return triangles;
}


// ============================================================================
// 4. 区域判定与评分逻辑
// ============================================================================

/**
 * 判定三角形所属区域
 * 逻辑：多数投票原则 (三个顶点中有 >=2 个属于同一区域，则三角形属于该区域)
 */
export function getTriangleZone(p1: number, p2: number, p3: number): ZoneKey | null {
    const z1 = VERTEX_ZONE_MAP[p1];
    const z2 = VERTEX_ZONE_MAP[p2];
    const z3 = VERTEX_ZONE_MAP[p3];

    if (z1 && (z1 === z2 || z1 === z3)) return z1;
    if (z2 && (z2 === z3)) return z2;

    // 如果三个都不一样，或者有两个是 null，则丢弃该三角形
    return null;
}

/**
 * 获取指定维度的区域评分 (0-100, 越高越严重)
 */
export function getZoneScore(zoneData: ZoneData, dimension: DimensionKey): number {
    // 默认回退值
    const DEFAULT_SCORE = 20;

    switch (dimension) {
        case "oil":
            // 油分主要看 oil，其次看 pores
            return zoneData.oil ?? zoneData.pores ?? DEFAULT_SCORE;
        case "pores":
            return zoneData.pores ?? zoneData.texture ?? DEFAULT_SCORE;
        case "wrinkles": {
            if (zoneData.wrinkles != null) return zoneData.wrinkles;
            if (zoneData.firmness != null) return 100 - zoneData.firmness; // firmness 越高越好 -> 反转
            return DEFAULT_SCORE;
        }
        case "spots":
            return zoneData.spots ?? zoneData.redness ?? DEFAULT_SCORE;
        case "acne": {
            // 痘痘通常看 spots + redness + texture
            const acneScore = ((zoneData.spots || 0) + (zoneData.redness || 0)) / 2;
            return acneScore || DEFAULT_SCORE;
        }
        case "darkCircles":
            return zoneData.darkCircles ?? DEFAULT_SCORE;
        case "overall":
        default: {
            // 综合评分：取各个维度的最大值 (短板效应)
            const scores = [
                zoneData.oil || 0,
                zoneData.wrinkles || 0,
                zoneData.spots || 0,
                zoneData.pores || 0,
                zoneData.redness || 0,
                zoneData.darkCircles || 0,
                zoneData.texture ? (100 - zoneData.texture) : 0 // texture 越低越差 -> 分数越高越严重
            ];
            return Math.max(...scores) || DEFAULT_SCORE;
        }
    }
}


// ============================================================================
// 5. 高级 HSL 颜色引擎
// ============================================================================

/**
 * 评分 -> HSL 颜色 (连续插值)
 * 0 (健康) -> 100 (严重)
 */
export function scoreToColor(score: number): string {
    // 确保分数在 0-100
    const clampedScore = Math.max(0, Math.min(100, score));
    const t = clampedScore / 100; // 归一化 0.0 - 1.0

    // 虽然是 "热力图"，但为了美观，我们定义一个更自然的渐变
    // 0:   透明/微绿 (健康)
    // 0.3: 鹅黄 (轻微)
    // 0.6: 暖橙 (警告)
    // 0.9: 深红 (严重)

    let h, s, l, a;

    if (t < 0.3) {
        // 0.0 - 0.3: 绿色 -> 黄色
        // Hue: 120 (绿) -> 60 (黄)
        const localT = t / 0.3;
        h = 120 - (60 * localT);
        s = 70;
        l = 50;
        a = 0.05 + (0.2 * localT); // 透明度 0.05 -> 0.25 (还是比较通透的)
    } else if (t < 0.6) {
        // 0.3 - 0.6: 黄色 -> 橙色
        // Hue: 60 (黄) -> 30 (橙)
        const localT = (t - 0.3) / 0.3;
        h = 60 - (30 * localT);
        s = 85;
        l = 55;
        a = 0.25 + (0.2 * localT); // 透明度 0.25 -> 0.45
    } else {
        // 0.6 - 1.0: 橙色 -> 红色
        // Hue: 30 (橙) -> 0 (红)
        const localT = (t - 0.6) / 0.4;
        h = 30 - (30 * localT);
        s = 90;
        l = 50 - (5 * localT); // 亮度稍微降低，增加厚重感
        a = 0.45 + (0.35 * localT); // 透明度 0.45 -> 0.8 (严重问题要很明显)
    }

    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * 获取指定顶点的区域 (用于交互检测)
 */
export function getVertexZone(index: number): ZoneKey | null {
    return VERTEX_ZONE_MAP[index];
}

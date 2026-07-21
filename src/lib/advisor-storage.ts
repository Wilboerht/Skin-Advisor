/**
 * IndexedDB Storage Utility for Large Data (Images, Results)
 * localStorage has ~5MB limit, IndexedDB can store much more
 */

const DB_NAME = "MySkinAdvisorDB";
const DB_VERSION = 1;
const STORES = {
    faceImages: "faceImages",
    results: "results",
};

// 人脸照片与分析结果属于敏感数据，默认仅保留 1 小时，避免长期留存本地
const MAX_STORAGE_AGE_MS = 60 * 60 * 1000;

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize and get the database connection
 */
function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error("IndexedDB open error:", request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.faceImages)) {
                db.createObjectStore(STORES.faceImages, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(STORES.results)) {
                db.createObjectStore(STORES.results, { keyPath: "id" });
            }
        };
    });
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
    try {
        return typeof indexedDB !== "undefined" && indexedDB !== null;
    } catch {
        return false;
    }
}

/**
 * Save face images to IndexedDB
 */
export async function saveFaceImages(images: {
    front?: string;
    left?: string;
    right?: string;
    chin?: string;
}): Promise<boolean> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.faceImages, "readwrite");
            const store = transaction.objectStore(STORES.faceImages);

            const request = store.put({
                id: "current",
                images,
                timestamp: Date.now(),
            });

            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error("Save face images error:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("IndexedDB saveFaceImages error:", error);
        return false;
    }
}

/**
 * Get face images from IndexedDB
 */
export async function getFaceImages(): Promise<{
    front?: string;
    left?: string;
    right?: string;
    chin?: string;
} | null> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.faceImages, "readonly");
            const store = transaction.objectStore(STORES.faceImages);
            const request = store.get("current");

            request.onsuccess = () => {
                if (request.result) {
                    if (Date.now() - request.result.timestamp > MAX_STORAGE_AGE_MS) {
                        // 过期数据视为不存在（由 clearExpiredData 统一清理）
                        resolve(null);
                    } else {
                        resolve(request.result.images);
                    }
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.error("Get face images error:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("IndexedDB getFaceImages error:", error);
        return null;
    }
}

/**
 * Save analysis result to IndexedDB
 */
export async function saveResult(result: unknown): Promise<boolean> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.results, "readwrite");
            const store = transaction.objectStore(STORES.results);

            const request = store.put({
                id: "current",
                result,
                timestamp: Date.now(),
            });

            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error("Save result error:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("IndexedDB saveResult error:", error);
        return false;
    }
}

/**
 * Get analysis result from IndexedDB
 */
export async function getResult(): Promise<unknown | null> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.results, "readonly");
            const store = transaction.objectStore(STORES.results);
            const request = store.get("current");

            request.onsuccess = () => {
                if (request.result) {
                    if (Date.now() - request.result.timestamp > MAX_STORAGE_AGE_MS) {
                        resolve(null);
                    } else {
                        resolve(request.result.result);
                    }
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.error("Get result error:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("IndexedDB getResult error:", error);
        return null;
    }
}

/**
 * Clear all stored data (for cleanup)
 */
export async function clearAllData(): Promise<boolean> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                [STORES.faceImages, STORES.results],
                "readwrite"
            );

            const faceStore = transaction.objectStore(STORES.faceImages);
            const resultStore = transaction.objectStore(STORES.results);

            faceStore.clear();
            resultStore.clear();

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => {
                console.error("Clear all error:", transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error("IndexedDB clearAllData error:", error);
        return false;
    }
}

/**
 * Clear expired data (older than specified hours)
 */
export async function clearExpiredData(maxAgeHours: number = 24): Promise<void> {
    try {
        const db = await getDB();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();

        const transaction = db.transaction(
            [STORES.faceImages, STORES.results],
            "readwrite"
        );

        // Check and clear face images
        const faceStore = transaction.objectStore(STORES.faceImages);
        const faceRequest = faceStore.get("current");
        faceRequest.onsuccess = () => {
            if (faceRequest.result && now - faceRequest.result.timestamp > maxAgeMs) {
                faceStore.delete("current");
                if (process.env.NODE_ENV !== "production") console.log("Cleared expired face images");
            }
        };

        // Check and clear results
        const resultStore = transaction.objectStore(STORES.results);
        const resultRequest = resultStore.get("current");
        resultRequest.onsuccess = () => {
            if (resultRequest.result && now - resultRequest.result.timestamp > maxAgeMs) {
                resultStore.delete("current");
                if (process.env.NODE_ENV !== "production") console.log("Cleared expired result");
            }
        };
    } catch (error) {
        console.error("IndexedDB clearExpiredData error:", error);
    }
}

/**
 * Hybrid storage utility - tries IndexedDB first, falls back to localStorage
 */
export const advisorStorage = {
    async saveFaceImages(images: { front?: string; left?: string; right?: string; chin?: string }): Promise<boolean> {
        // Try IndexedDB first
        if (isIndexedDBAvailable()) {
            try {
                const success = await saveFaceImages(images);
                if (success) {
                    // Also save a marker in localStorage for quick check
                    localStorage.setItem("advisor_face_images_idb", "true");
                    // Remove legacy localStorage data
                    localStorage.removeItem("advisor_face_images");
                    return true;
                }
            } catch (e) {
                console.warn("IndexedDB save failed, falling back to localStorage");
            }
        }

        // Fallback to localStorage
        try {
            localStorage.setItem("advisor_face_images", JSON.stringify(images));
            localStorage.removeItem("advisor_face_images_idb");
            return true;
        } catch (e) {
            console.error("localStorage save failed too");
            return false;
        }
    },

    async getFaceImages(): Promise<{ front?: string; left?: string; right?: string; chin?: string } | null> {
        // Check if we have IndexedDB data
        if (localStorage.getItem("advisor_face_images_idb") && isIndexedDBAvailable()) {
            try {
                const images = await getFaceImages();
                if (images) return images;
            } catch (e) {
                console.warn("IndexedDB get failed, trying localStorage");
            }
        }

        // Try localStorage
        try {
            const str = localStorage.getItem("advisor_face_images");
            if (str) return JSON.parse(str);
        } catch (e) {
            console.error("localStorage parse error");
        }

        return null;
    },

    async saveResult(result: Record<string, unknown>): Promise<boolean> {
        if (isIndexedDBAvailable()) {
            try {
                const success = await saveResult(result);
                if (success) {
                    localStorage.setItem("advisor_result_idb", "true");
                    localStorage.removeItem("advisor_result");
                    return true;
                }
            } catch (e) {
                console.warn("IndexedDB save failed, falling back to localStorage");
            }
        }

        try {
            localStorage.setItem("advisor_result", JSON.stringify(result));
            localStorage.removeItem("advisor_result_idb");
            return true;
        } catch (e) {
            console.error("localStorage save failed too");
            return false;
        }
    },

    async getResult(): Promise<Record<string, unknown> | null> {
        if (localStorage.getItem("advisor_result_idb") && isIndexedDBAvailable()) {
            try {
                const result = await getResult();
                if (result) return result as Record<string, unknown>;
            } catch (e) {
                console.warn("IndexedDB get failed, trying localStorage");
            }
        }

        try {
            const str = localStorage.getItem("advisor_result");
            if (str) return JSON.parse(str);
        } catch (e) {
            console.error("localStorage parse error");
        }

        return null;
    },

    async saveProcessedImages(images: { front?: string; left?: string; right?: string; chin?: string }): Promise<boolean> {
        try {
            localStorage.setItem("advisor_processed_images", JSON.stringify({
                images,
                timestamp: Date.now(),
            }));
            return true;
        } catch (e) {
            console.error("Failed to save processed images", e);
            return false;
        }
    },

    async getProcessedImages(): Promise<{ front?: string; left?: string; right?: string; chin?: string } | null> {
        try {
            const str = localStorage.getItem("advisor_processed_images");
            if (!str) return null;
            const data = JSON.parse(str);
            // 24小时过期
            if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem("advisor_processed_images");
                return null;
            }
            return data.images;
        } catch (e) {
            return null;
        }
    },

    async clearAll(): Promise<void> {
        // Clear IndexedDB
        if (isIndexedDBAvailable()) {
            try {
                await clearAllData();
            } catch (e) {
                console.warn("IndexedDB clear failed");
            }
        }

        // Clear localStorage markers and data
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_face_images_idb");
        localStorage.removeItem("advisor_result");
        localStorage.removeItem("advisor_result_idb");
        localStorage.removeItem("advisor_processed_images");
        localStorage.removeItem("advisor_step");
    },
};

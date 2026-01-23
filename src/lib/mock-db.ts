import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data", "share-reward-db.json");

// 确保目录存在
const ensureDb = () => {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            campaigns: [
                {
                    id: "camp_001",
                    name: "NIHPLOD 护肤顾问体验季",
                    description: "分享您的专属测肤报告，上传朋友圈/小红书分享截图，即可免费领取「光蕴焕活精华」体验装一份。",
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days later
                    purchaseStartDate: new Date().toISOString(),
                    purchaseEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    rewardType: "sample",
                    rewardDescription: "NIHPLOD 光蕴焕活精华液 5ml 体验装",
                    isActive: true
                }
            ],
            submissions: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
};

export interface Submission {
    id: string;
    campaignId: string;
    contact: string; // Used as unique identifier (e.g. phone)
    name: string;
    phone: string;
    shippingAddress: string;
    shareProofUrl: string;
    purchaseProofUrl?: string;
    skinScore: number;
    percentile: number;
    status: "pending" | "approved" | "rejected";
    rejectReason?: string;
    shippingStatus?: "pending" | "shipped" | "contacted";
    createdAt: string;
}

const readDb = () => {
    ensureDb();
    try {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to read DB:", error);
        return { campaigns: [], submissions: [] };
    }
};

const writeDb = (data: any) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error("Failed to write DB:", error);
        return false;
    }
};

export const MockDB = {
    getActiveCampaign: () => {
        const db = readDb();
        return db.campaigns.find((c: any) => c.isActive);
    },

    getSubmission: (campaignId: string, contact: string) => {
        const db = readDb();
        return db.submissions.find(
            (s: any) => s.campaignId === campaignId && s.contact === contact
        );
    },

    createSubmission: (data: Omit<Submission, "id" | "status" | "createdAt">) => {
        const db = readDb();
        const newSubmission: Submission = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...data,
            status: "pending",
            createdAt: new Date().toISOString(),
        };

        // Remove existing if any (allow resubmit?) - let's just append or update
        const existingIndex = db.submissions.findIndex(
            (s: any) => s.campaignId === data.campaignId && s.contact === data.contact
        );

        if (existingIndex >= 0) {
            // Update existing
            db.submissions[existingIndex] = {
                ...db.submissions[existingIndex],
                ...newSubmission,
                status: "pending", // Reset status on resubmit
                id: db.submissions[existingIndex].id // keep ID
            };
        } else {
            db.submissions.push(newSubmission);
        }

        writeDb(db);
        return newSubmission;
    }
};

import { z } from "zod"

export const CAMPAIGN_STATUSES = ["draft", "active", "ended"] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "草稿",
  active: "进行中",
  ended: "已结束",
}

export interface Prize {
  productId?: string
  name: string
  image?: string
  price?: string
  quantity: number
  description?: string
}

export interface Campaign {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  coverImage: string | null
  status: CampaignStatus
  startDate: string
  endDate: string
  drawDate: string | null
  prizes: Prize[]
  shareText: string | null
  rules: string | null
  maxEntries: number
  sortOrder: number
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const prizeSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "奖品名称不能为空"),
  image: z.string().optional(),
  price: z.string().optional(),
  quantity: z.number().min(1, "奖品数量至少为 1"),
  description: z.string().optional(),
})

export const campaignCreateSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  drawDate: z.string().optional(),
  prizes: z.array(prizeSchema).min(1, "至少需要一个奖品"),
  shareText: z.string().optional(),
  rules: z.string().optional(),
  maxEntries: z.number().min(0).default(0),
  sortOrder: z.number().default(0),
  status: z.enum(CAMPAIGN_STATUSES).default("draft"),
})

export const campaignUpdateSchema = campaignCreateSchema.partial().omit({ status: true }).extend({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
})

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>

export const campaignQuerySchema = z.object({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export function isValidCampaignStatus(value: string): value is CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus)
}

export function toISOLocalString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

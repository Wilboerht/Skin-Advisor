import resultContent from "./result-content.json";

export interface M1Data {
  typeName: string;
  scoreRange: string;
  persona: string;
  slogan: string;
  visualDirection: string;
}

export interface M2Data {
  openingQuote: string;
  portrait: string;
}

export interface M3Data {
  title: string;
  analysis: string;
}

export interface M4Data {
  title: string;
  scene?: string;
  morning?: string;
  night?: string;
}

export interface Advantage {
  title: string;
  content: string;
}

export interface M5Data {
  title: string;
  advantages: Advantage[];
  quote: string;
}

export interface Reminder {
  title: string;
  content: string;
}

export interface M6Data {
  title: string;
  reminders: Reminder[];
}

export interface Suggestion {
  title: string;
  content: string;
}

export interface M7Data {
  title: string;
  formulaCore: string;
  suggestions: Suggestion[];
  ingredientTable: Record<string, string>[];
  onlyOneSet: string;
}

export interface RadarDimension {
  dimension: string;
  score: number;
  interpretation: string;
}

export interface M8Data {
  radar: RadarDimension[];
  interpretation: string;
}

export interface M9Data {
  title: string;
  lifestyle: string;
  aesthetic: string;
  spirit: string;
  occasions: string;
}

export interface M10Data {
  xiaohongshu: string;
  wechat: string;
  phrases: string[];
  hashtags: string[];
}

export interface SkinTypeData {
  typeName: string;
  scoreRange: string;
  route: string;
  m1: M1Data;
  m2: M2Data;
  m3: M3Data;
  m4: M4Data;
  m5: M5Data;
  m6: M6Data;
  m7: M7Data;
  m8: M8Data;
  m9: M9Data;
  m10: M10Data;
}

export const skinTypes = resultContent as unknown as SkinTypeData[];

export const routeOrder = [
  "jiejinkuangmo",
  "kangkuadaren",
  "tangpingwanjia",
  "rouguangdaren",
  "wenfuwanjia",
  "shengtukuangmo",
  "shirundaren",
  "donglingwanjia",
  "tianfukuangmo",
  "yulingzhuzai",
];

export function getSkinTypeByRoute(route: string): SkinTypeData | undefined {
  return skinTypes.find((t) => t.route === route);
}

export function getSkinTypeIndex(route: string): number {
  return routeOrder.indexOf(route);
}

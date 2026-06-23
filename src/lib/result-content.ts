import resultContent from "./result-content.json";

export interface M1Data {
  typeName: string;
  scoreRange: string;
  persona: string;
}

export interface M2Data {}

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

export interface SkinTypeData {
  typeName: string;
  scoreRange: string;
  route: string;
  m1: M1Data;
  m2: M2Data;
  m4: M4Data;
  m5: M5Data;
  m7: M7Data;
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

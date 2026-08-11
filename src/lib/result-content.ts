import resultContent from "./result-content.json";

export interface M1Data {
  typeName: string;
  ipKey: string;
  persona: string;
}

// m2 区块当前 JSON 结构无固定字段，用宽泛对象类型代替空 interface
export type M2Data = Record<string, unknown>;

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
  ipKey: string;
  route: string;
  m1: M1Data;
  m2: M2Data;
  m4: M4Data;
  m5: M5Data;
  m7: M7Data;
}

export const skinTypes = resultContent as unknown as SkinTypeData[];

export const routeOrder = [
  "minminpai",
  "jijianpai",
  "shehuapai",
  "donglingpai",
  "shamopai",
  "youtiaopai",
  "hunhepai",
  "shouhupai",
];

export function getSkinTypeByRoute(route: string): SkinTypeData | undefined {
  return skinTypes.find((t) => t.route === route);
}

export function getSkinTypeIndex(route: string): number {
  return routeOrder.indexOf(route);
}

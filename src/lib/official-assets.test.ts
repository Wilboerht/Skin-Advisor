import { describe, it, expect } from "vitest";
import { officialImageSrc } from "./official-assets";

describe("officialImageSrc", () => {
  it("绝对 URL 原样返回", () => {
    expect(officialImageSrc("https://cdn.example.com/a.webp")).toBe(
      "https://cdn.example.com/a.webp"
    );
  });

  it("官网相对路径补全官网 origin", () => {
    expect(officialImageSrc("/uploads/products/a.webp")).toMatch(
      /^https?:\/\/.+\/uploads\/products\/a\.webp$/
    );
  });

  it("带目录的裸相对路径补全 origin，纯文件名按 products 目录补全", () => {
    expect(officialImageSrc("uploads/products/a.webp")).toMatch(
      /^https?:\/\/.+\/uploads\/products\/a\.webp$/
    );
    expect(officialImageSrc("1776941523999-abc.webp")).toMatch(
      /^https?:\/\/.+\/uploads\/products\/1776941523999-abc\.webp$/
    );
  });

  it("空值返回 null", () => {
    expect(officialImageSrc(null)).toBeNull();
    expect(officialImageSrc(undefined)).toBeNull();
    expect(officialImageSrc("")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { inProfileFocusRegion } from "./profileFocusRegion";

const home = { left: 100, top: 300, width: 200, height: 400 };
const center = { left: 450, top: 150, width: 300, height: 500 };
describe("profile hover continuity", () => {
  it("retains the invisible original footprint", () =>
    expect(inProfileFocusRegion({ x: 120, y: 680 }, home, center)).toBe(true));
  it("retains the centered card", () =>
    expect(inProfileFocusRegion({ x: 700, y: 180 }, home, center)).toBe(true));
  it("retains travel between the cards", () =>
    expect(inProfileFocusRegion({ x: 375, y: 400 }, home, center)).toBe(true));
  it("tolerates a small boundary tremor", () =>
    expect(inProfileFocusRegion({ x: 95, y: 350 }, home, center)).toBe(true));
  it("rejects the surrounding workspace", () =>
    expect(inProfileFocusRegion({ x: 900, y: 800 }, home, center)).toBe(false));
  it("does not retain empty corners outside the travel corridor", () =>
    expect(inProfileFocusRegion({ x: 110, y: 160 }, home, center)).toBe(false));
});

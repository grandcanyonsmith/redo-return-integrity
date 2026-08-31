import { describe, expect, it } from "vitest";
import {
  customerCopyHasForbiddenLanguage,
  decideVerifyRoute,
  defaultVerifyModuleId,
  modulesForTab,
  verifyModuleIds,
  verifyModules,
  verifyTabs,
} from "../src/verify-modules.js";

describe("verify modules", () => {
  it("catalogs ten rules across four tabs with two ways forward", () => {
    expect(verifyModules).toHaveLength(10);
    expect(verifyModules.map((module) => module.id)).toEqual([...verifyModuleIds]);
    expect(verifyTabs.every((tab) => modulesForTab(tab).length > 0)).toBe(true);
    for (const module of verifyModules) {
      expect(module.choices).toHaveLength(2);
      expect(module.ifConditions).toHaveLength(2);
      expect(module.thenRoutes).toHaveLength(2);
      expect(customerCopyHasForbiddenLanguage(module)).toBe(false);
    }
  });

  it("never denies from one elevated signal", () => {
    expect(decideVerifyRoute({ elevated: false })).toEqual({ action: "continue" });
    expect(decideVerifyRoute({ elevated: true })).toEqual({
      action: "secure_route",
      moduleId: defaultVerifyModuleId,
    });
    expect(decideVerifyRoute({ elevated: true, moduleId: "condition" })).toEqual({
      action: "secure_route",
      moduleId: "condition",
    });
    expect(JSON.stringify(decideVerifyRoute({ elevated: true }))).not.toMatch(/deny/i);
  });

  it("features delivery as the default secure route", () => {
    const delivery = verifyModules.find((module) => module.id === "delivery");
    expect(delivery?.customerTitle).toMatch(/verify your delivery/i);
    expect(delivery?.choices.map((choice) => choice.label)).toEqual([
      "Pickup near me",
      "Authenticated home delivery",
    ]);
    expect(delivery?.impact.completionLabel).toBe("87% complete checkout");
    expect(delivery?.impact.protectedLabel).toBe("$42.3K protected / month");
  });
});

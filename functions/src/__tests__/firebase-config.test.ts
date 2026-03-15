import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const firebaseJson = JSON.parse(
  readFileSync(resolve(__dirname, "../../../firebase.json"), "utf-8")
);

describe("firebase.json configuration", () => {
  describe("functions emulator", () => {
    it("has functions emulator on port 5001", () => {
      expect(firebaseJson.emulators.functions).toEqual({ port: 5001 });
    });
  });

  describe("functions deploy config", () => {
    it('has functions source set to "functions"', () => {
      expect(firebaseJson.functions.source).toBe("functions");
    });

    it("has predeploy with npm ci and npm run build", () => {
      const predeploy: string[] = firebaseJson.functions.predeploy;
      expect(predeploy).toBeDefined();
      expect(predeploy.some((cmd: string) => cmd.includes("npm") && cmd.includes("ci"))).toBe(true);
      expect(predeploy.some((cmd: string) => cmd.includes("npm") && cmd.includes("build"))).toBe(true);
    });
  });

  describe("CSP connect-src", () => {
    it("includes https://*.cloudfunctions.net", () => {
      const globalHeaders = firebaseJson.hosting.headers.find(
        (h: { source: string }) => h.source === "**"
      );
      const cspHeader = globalHeaders.headers.find(
        (h: { key: string }) => h.key === "Content-Security-Policy"
      );
      expect(cspHeader.value).toContain("https://*.cloudfunctions.net");
    });
  });
});

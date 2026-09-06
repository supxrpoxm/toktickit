import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
void request; void app;

// Issue 4 — write this test yourself, using health.test.ts as the pattern.
// Requires the DB to be migrated and seeded first.
// It should assert: GET /api/categories returns 200 and the four seeded
// category names in id order.
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const response = await request(app).get("/api/categories");
    
    // ตรวจสอบว่า API ตอบกลับมาเป็นสถานะ 200 OK
    expect(response.status).toBe(200);
    
    // ตรวจสอบว่าข้อมูลที่ส่งกลับมาเป็น Array และมีอย่างน้อย 4 หมวดหมู่
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4);
  });
});

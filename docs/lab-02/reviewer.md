# Lab 2: Peer Review Evidence

**My Name:** [Panuwat Boonsak]
**Reviewer Name:** [Rattananan Siriponvat,Krittamate Niyomtham]

## Pull Request Links
- [Issue 1: Sprint Specification and Test Plan] (https://github.com/supxrpoxm/toktickit/pull/12)
- [Issue 2: Database Models and Seed Data] (https://github.com/supxrpoxm/toktickit/pull/14)
- [Issue 3: Requester Selection (หน้าจอและ API สำหรับเลือกผู้แจ้งเรื่อง)] (https://github.com/supxrpoxm/toktickit/pull/16)
- [Issue 4: โครงสร้าง Layout หลัก และหน้าฟอร์มสร้างตั๋ว (Create Ticket UI)] (https://github.com/supxrpoxm/toktickit/pull/18)
- [Issue 5: My Tickets List API & UI] (https://github.com/supxrpoxm/toktickit/pull/20)
- [Issue 6: Requester Ticket Detail API & UI] (https://github.com/supxrpoxm/toktickit/pull/22)
- [Issue 7: Attachment Management Lifecycle API & UI] (https://github.com/supxrpoxm/toktickit/pull/24)
- [Issue 8: Automated Tests & E2E Validation] (https://github.com/supxrpoxm/toktickit/pull/26)
- [Issue 9: Visual Inspection & Responsive Checks] (https://github.com/supxrpoxm/toktickit/pull/28)

## Review Details
- **Comments Received & Peer Feedback:**
  - **Issue 1-3 (โดย Rattananan):** 
    - ชมโครงสร้างสเปกชัดเจน
    - ตรวจสอบ Prisma Schema พบว่าออกแบบ relations, foreign keys และใช้ `upsert` ป้องกันข้อมูลซ้ำได้ดีมาก (Idempotent)
    - ตรวจสอบ API `/api/requesters` และ `RequesterSelect.tsx` พบว่ากรอง `isActive: true`, จัดการ Clean-up effect (ignore), สถานะ Loading/Error และคุมโทนสี Zen Green ถูกต้องครบถ้วน
  - **Issue 4 & 6-7 (โดย Rattananan):** 
    - ยืนยันว่าหน้าจอ Create Ticket, Ticket Detail และระบบจัดการ Attachment ทำได้สะอาด เป็นระเบียบ ตรงตาม Scope และ UI Spec
  - **Issue 5 (โดย Krittamate):** 
    - แนะนำให้เพิ่ม `useEffect` ที่ผูกกับ `[search, statusFilter, sortBy, page]`
    - ให้เพิ่ม query params สำหรับดึง API `/api/tickets`
    - ต้องใส่ `onClick` handlers ในปุ่ม Pagination และจัดการ state หน้า
    - ต้องแนบ `x-requester-id` header ในคำขอ API ด้วย
  - **Issue 8-9 (โดย Rattananan):** 
    - ชื่นชมระบบ Automated Tests ทั้ง Unit และ E2E ที่ครอบคลุม (Happy path, error cases, validation, permission)
    - ตรวจสอบการใช้ Playwright สำหรับตรวจสอบ UI, Responsive Layout (Desktop, Tablet, Mobile) และการจัดเก็บ Screenshots ใน `artifacts/lab-02/screenshots/` ว่าทำได้สมบูรณ์พร้อม Merge
- **My Response & Action Taken:** 
  - นำคำแนะนำของ Rattananan ไปตรวจสอบความเรียบร้อยของโค้ดในภาพรวมทั้งหมดผ่านฉลุย
  - ดำเนินการปรับปรุงโค้ดใน Issue 5 ตามฟีดแบ็กของ Krittamate (ปุ้น) โดยเพิ่ม `useEffect` สำหรับตัวกรอง, ทำปุ่ม Pagination ให้คลิกเปลี่ยนหน้าได้จริง, และเพิ่มการแนบ `x-requester-id` header สำเร็จเรียบร้อย
- **Approval Status:** Approved and Merged ✅

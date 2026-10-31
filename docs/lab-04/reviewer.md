Lab 4: Peer Review Evidence
My Name: Panuwat Boonsak (Student ID: 67070501034)

Reviewer Name: Rattananan Siriponvat

Pull Request Links
Issue 1: Sprint 4 Engineering Contract & Specification - [https://github.com/supxrpoxm/toktickit/pull/45]

Issue 2: Actions Taken Foundation & REST APIs - [https://github.com/supxrpoxm/toktickit/pull/47]

Issue 3: Actions Taken UI & Form Validations - [https://github.com/supxrpoxm/toktickit/pull/48]

Issue 4: Ticket Workflow & Resolution Gate - [https://github.com/supxrpoxm/toktickit/pull/51]

Issue 5: Search, Filter & Role-Based Dashboards - [https://github.com/supxrpoxm/toktickit/pull/52]

Issue 6: Final Hardening, Full Regression, and Release Integration - [https://github.com/supxrpoxm/toktickit/pull/55]

Test Accounts
Administrator: admin@toktickit.com / Password123!

IT Staff: staff@toktickit.com / Password123!

Requester: requester@toktickit.com / Password123!

Review Details
Comments Received & Peer Feedback:
Issue 1 (by Rattananan Siriponvat):

มีการจัดทำ docs/lab-04/specification.md, tests.md, ui-spec.md, และ api-spec.md ครบถ้วนตามมาตรฐาน Spec DD[cite: 8]

ระบุ Business Rules (BR-01, BR-02) เรื่อง Actions Taken เชื่อมโยงกับ Ticket ชัดเจน[cite: 3] โดยกำหนดให้ Ticket Owner เป็นผู้ประสานงานหลัก แต่ Staff คนอื่นสามารถบันทึก Action Taken ได้[cite: 1, 3]

มีการกำหนด Resolution Gate และ State Transition Matrix ครบทั้ง 8 สถานะอย่างรัดกุม[cite: 3] PR กำหนด Base Branch ไปที่ lab4-staging ถูกต้อง[cite: 10]

Issue 2 (by Rattananan Siriponvat):

โมเดล ActionTaken ใน Prisma ออกแบบ One-to-Many กับ Ticket ได้ถูกต้อง มีฟิลด์ครบถ้วน (date/time, description, result, performedBy, followUpRequired, followUpNote, attachmentNotes)[cite: 1, 2, 4]

API Endpoints มีการตรวจเช็ค Authorization อย่างเข้มงวด โดยอนุญาตเฉพาะ IT Staff และ Admin ในการสร้าง/แก้ไข[cite: 3]

การทำ Database Migration ไม่กระทบข้อมูลเดิมของ Lab 1–3 และมี Idempotent Seed Data รองรับการทดสอบ (Unit/API Tests ผ่านเรียบร้อย)[cite: 4]

Issue 3 (by Rattananan Siriponvat):

ส่วนแสดงผล Actions Taken ในหน้า Ticket Detail แสดงประวัติการทำงานได้ชัดเจน จัดเรียงตามลำดับเวลา[cite: 6, 11]

หน้า UI แยกสิทธิ์ชัดเจน: Requester เห็นประวัติการซ่อมแบบ Read-only (ไม่มีปุ่มเพิ่ม/แก้ไข)[cite: 2, 6] ขณะที่ Staff/Admin มีฟอร์มเพิ่ม Action ได้สะดวก[cite: 3, 6]

มี Validation Rules ชัดเจน (เช่น บังคับกรอก Follow-up Note เมื่อติ๊ก Follow-Up Required)[cite: 2, 6] มีระบบป้องกันการกดส่งข้อมูลซ้ำ (Double-submission disabled)[cite: 8] และรองรับ Responsive View บนหน้าจอมือถือ (Component Tests ผ่านเรียบร้อย)

Issue 4 (by Rattananan Siriponvat):

ระบบ Resolution Gate ทำงานสมบูรณ์: Backend สกัดกั้นไม่ยอมให้เปลี่ยนสถานะเป็น Resolved หากตั๋วยังไม่มีรายการ Action Taken อย่างน้อย 1 รายการ แม้จะพยายามยิง API ตรงก็ตาม[cite: 3]

สถานะตั๋วแสดงตัวเลือกเฉพาะ Transition ที่ได้รับอนุญาตตาม Role[cite: 3, 6]

ปุ่มส่งสัญญาณของ Requester ("Problem Appears Resolved") ทำงานในฐานะ Advisory Flag อย่างถูกต้อง โดยไม่ข้ามสิทธิ์ไปเปลี่ยนสถานะหลักเป็น Resolved ด้วยตนเอง[cite: 3] จัดการ Concurrency 409 Conflict ได้ดี (Integration Tests ผ่านเรียบร้อย)[cite: 4, 8]

Issue 5 (by Rattananan Siriponvat):

IT Staff Dashboard แสดงตัวเลขสถิติ (Metrics) สรุปจำนวนตั๋ว (New, Open, In Progress, Waiting, Assigned) สอดคล้องกับการคำนวณของ Database จริง[cite: 3, 5]

แถบ Search และ Multi-parameter Filter (Status, Priority, Department) ทำงานรวดเร็ว และมีปุ่ม Drill-down เข้าไปยังหน้ารายการตั๋วที่เกี่ยวข้องได้อย่างแม่นยำ[cite: 3, 5]

Requester Dashboard แสดงเฉพาะตั๋วที่เป็นของตนเองเท่านั้น (Data Isolation สมบูรณ์)[cite: 3, 6] จัดการ Empty State ("No tickets found") และ Loading State ได้เรียบร้อยตามแนวทาง Zen Green[cite: 5, 8] (Tests ผ่านเรียบร้อย)

Issue 6 (by Rattananan Siriponvat):

ผ่านการทดสอบ Playwright E2E Tests ครบทั้ง 3 ชุด (actions-taken-flow.spec.ts, ticket-resolution.spec.ts, dashboards.spec.ts)[cite: 10, 11]

รัน Full Regression Tests ทั้งฝั่ง Client และ Server (รวมของเก่าตั้งแต่ Lab 1 ถึง Lab 3) ผลลัพธ์ผ่าน 100% ปราศจากข้อผิดพลาดตกค้าง (Zero Regression)[cite: 1, 8, 10]

UI ได้รับการปรับแต่งความสอดคล้องตาม Zen Green Shell ไม่มี Console Errors, ไม่มีปัญหาข้อความล้นจอหรือ Horizontal Scroll บน Mobile[cite: 5, 8] พร้อมสำหรับ Final Staged Integration เข้าสู่ main[cite: 9, 10]

My Response & Action Taken:
รับทราบข้อเสนอแนะและผลการตรวจสอบจากผู้รีวิว

ได้ดำเนินการ Re-generate Prisma Client และเคลียร์ Local TypeScript Cache เพื่อให้ระบบตรวจจับ Model ActionTaken ได้แม่นยำ ปราศจาก Type Error ตกค้าง

ปรับปรุงการจัดการ Concurrency Control (Optimistic Lock / Stale Update Handling) บน Ticket Workflow เพื่อป้องกันปัญหา Race Condition ขณะเปลี่ยนสถานะ[cite: 4]

ตรวจสอบความถูกต้องของสิทธิ์ Authorization ทุก Endpoint บน Backend โดยไม่พึ่งพาเพียงการซ่อนปุ่มบน UI[cite: 3]

รันชุดทดสอบทั้งหมด (Unit, API Integration, Component, Full Regression, E2E) ยืนยันผลการทดสอบผ่านเขียวทั้งหมด จึงได้ดำเนินการ Approve และ Merge ทุก Feature Branch เข้าสู่ lab4-staging และรวมเข้าสู่ main ตามลำดับขั้นตอนทางวิศวกรรมซอฟต์แวร์[cite: 10]

Approval Status
Approved and Merged ✅
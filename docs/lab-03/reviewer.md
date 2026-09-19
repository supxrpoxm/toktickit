# Lab 3: Peer Review Evidence

**My Name:** Panuwat Boonsak (Student ID: 67070501034)
**Reviewer Name:** Rattananan Siriponvat

## Pull Request Links
- Issue 1: Sprint 3 Engineering Contract - [https://github.com/supxrpoxm/toktickit/pull/33]
- Issue 2: Authentication Foundation & UI - [https://github.com/supxrpoxm/toktickit/pull/35]
- Issue 3: IT Staff Ticket Queue - [https://github.com/supxrpoxm/toktickit/pull/37]
- Issue 4: IT Staff Ticket Operations - [https://github.com/supxrpoxm/toktickit/pull/39]
- Issue 5: Administrator User Management - [https://github.com/supxrpoxm/toktickit/pull/41]
- Issue 6: Final Fixes & Documentation - [https://github.com/supxrpoxm/toktickit/pull/42]

## Test Accounts
- **Administrator:** admin@example.com / password123
- **IT Staff:** staff@example.com / password123
- **Requester:** user@example.com / password123

## Review Details
- **Comments Received & Peer Feedback:**
  - **Issue 1 (by [ชื่อเพื่อน]):** 
    - มีการกำหนด Scope, Business Rules, Roles และ Acceptance Criteria ชัดเจน
    - มีการวางแผน Test ครอบคลุมทั้ง API, UI, Authorization และ E2E โดย UI Spec และ API Spec ระบุรายละเอียดที่จำเป็นครบถ้วน
    - มีการกำหนดสิทธิ์ของแต่ละ Role และ Flow การเปลี่ยน Password ครั้งแรกไว้อย่างชัดเจน PR target ไปที่ lab3-staging ถูกต้อง
  - **Issue 2 (by [ชื่อเพื่อน]):** 
    - ระบบ Authentication ทำงานครบ (Login, Logout, Session, Change Password) มีการ Hash Password ด้วย bcrypt ปลอดภัย
    - ระบบบังคับเปลี่ยนรหัสผ่านครั้งแรกได้ จัดการกรณี Login ผิดและบัญชีถูกปิดใช้งานได้อย่างเหมาะสม (ไม่เปิดเผยข้อมูลที่ไม่จำเป็น)
    - เปลี่ยนมาใช้ User ที่ Login จริงสำเร็จ หน้าเว็บมี Validation, Loading State และแสดง Role บน App Shell ชัดเจน (Test ผ่านเรียบร้อย)
  - **Issue 3 (by [ชื่อเพื่อน]):** 
    - ระบบ Ticket Queue จำกัดสิทธิ์เฉพาะ IT Staff และ Administrator ได้ถูกต้อง
    - ฟังก์ชัน Search, Filter, Sort และ Pagination ทำงานครบถ้วน แสดงผลข้อมูลสำคัญครบ UI ใช้งานง่ายสอดคล้องกับ Zen Green
    - จัดการ State ต่างๆ (Loading, Empty Data, Forbidden Access) ได้ดี รองรับการแสดงผลทุกขนาดหน้าจอ (Test ผ่านเรียบร้อย)
  - **Issue 4 (by [ชื่อเพื่อน]):** 
    - หน้ารายละเอียด Ticket สำหรับ IT Staff รองรับการเปลี่ยน Owner, IT Priority และ Status
    - แยก Public Comments (Requester เห็นได้) และ Internal Notes (เห็นเฉพาะ Staff/Admin) ออกจากกันชัดเจน เป็นระบบ Append-only และบันทึก Timestamp อัตโนมัติ
    - Requester สามารถกด "Problem Appears Resolved" ได้ และระบบ Attachment ยังทำงานได้ต่อเนื่อง (Test ผ่านเรียบร้อย)
  - **Issue 5 (by [ชื่อเพื่อน]):** 
    - ระบบ User Management จำกัดสิทธิ์เฉพาะ Administrator สามารถค้นหา, Filter, สร้าง และแก้ไข User ได้ครบถ้วน
    - ป้องกัน Administrator ปิดใช้งานบัญชีตัวเองหรือ Admin คนสุดท้ายได้อย่างรัดกุม และจัดการกรณี Email ซ้ำได้ปลอดภัย
    - ฟังก์ชัน Reset Initial Password ทำงานถูกต้อง และมีการแสดง State ต่างๆ บน UI ชัดเจน (Test ผ่านเรียบร้อย)
- **My Response & Action Taken:** 
  - รับทราบฟีดแบ็กจากผู้รีวิว ตรวจสอบโค้ดทุก Issue ยืนยันว่าครอบคลุม Requirement, กฎเรื่อง Authorization และการทำงานของ Automated Tests (Unit, API, E2E) ผ่านครบสมบูรณ์ทั้งหมด จึงได้ดำเนินการ Merge เข้าสู่ `lab3-staging` ตามแผน
## Approval StatusApproved and Merged ✅

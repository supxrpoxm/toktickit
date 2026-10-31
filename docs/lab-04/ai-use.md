# AI Use and Reflection - Lab 4 (TokTickIT)

## 1. LLM Tooling Identification
- **Primary AI Assistant:** Google Gemini (Gemini 2.5 Pro / Flash) & OpenCode Agent
- **Usage Purpose:**
  - Specification & Contract Formulation (Spec DD)
  - Prisma Schema Extension & Migration Review
  - Test Suite Design (TDD/Test DD for Backend, Frontend, and E2E)
  - Bug Diagnostics (TypeScript Prisma Client cache & EADDRINUSE Port Concurrency)
  - Code Refactoring & Final Application Hardening

---

## 2. Selected Key Prompts (Traceable to Sprint 4 Deliverables)

### Prompt 1: Engineering Contract & Specification (Spec DD)
> "ช่วยร่าง Engineering Contract และเอกสาร docs/lab-04/specification.md สำหรับ TokTickIT Lab 4 โดยกำหนด Business Rules (BR-01, BR-02) เกี่ยวกับ Actions Taken ที่ผูกกับตั๋วใบเดียวแต่ผู้ปฏิบัติงานเป็นคนละคนกับ Ticket Owner ได้ พร้อมทั้ง State Transition Matrix ของตั๋ว และการทำ Resolution Gate"

### Prompt 2: Database Schema & Migration (Issue 1 & 2)
> "ช่วยออกแบบโมเดล `ActionTaken` ใน `schema.prisma` ที่มีฟิลด์ actionDateTime, description, result, performedBy, followUpRequired, followUpNote, attachmentNotes พร้อมความสัมพันธ์กับ Ticket แบบ One-to-Many และแนวทาง Migration ที่ไม่กระทบข้อมูลเดิมในฐานข้อมูล"

### Prompt 3: Backend API & Authorization Matrix (Issue 2)
> "เขียน REST API endpoints สำหรับ `/api/tickets/:id/actions-taken` ใน Express โดยบังคับสิทธิ์ Authorization ให้เฉพาะ IT Staff และ Admin เท่านั้นที่สามารถสร้างหรือแก้ไข Action Taken ได้ ส่วน Requester มีสิทธิ์เพียงดูข้อมูลอย่างเดียว (Read-only)"

### Prompt 4: UI Component & Form Validation (Issue 3)
> "เขียน React Component สำหรับ Actions Taken ในหน้า Ticket Detail ตาม Zen Green Design Token ที่มีฟอร์มบันทึกข้อมูล พร้อมระบบ Validation ว่าถ้าติ๊ก 'Follow-Up Required' จะต้องบังคับกรอก 'Follow-up Note' เสมอ และป้องกันการกดส่งข้อมูลซ้ำ (Double-submission disabled)"

### Prompt 5: Troubleshooting TypeScript Compilation Error
> "โค้ดขึ้น error: `Property 'actionTaken' does not exist on type 'PrismaClient'` ทั้งที่รัน migrate แล้ว ขอวิธีวิเคราะห์และคำสั่งแก้ไขปัญหานี้ทีละขั้นตอน"

### Prompt 6: Ticket Workflow & Resolution Gate (Issue 4)
> "เขียน Middleware และ Business Logic ฝั่ง Backend ดักจับการเปลี่ยนสถานะตั๋วเป็น `RESOLVED` โดยไม่อนุญาตให้เปลี่ยนสถานะได้หากตั๋วใบนั้นยังไม่มีรายการ Action Taken อย่างน้อย 1 รายการ และรองรับ Advisory Flag สำหรับ Requester"

### Prompt 7: Port Concurrency & Process Cleanup
> "รันเซิร์ฟเวอร์แล้วเจอ `Error: listen EADDRINUSE: address already in use 0.0.0.0:3000` บน Windows ขอคำสั่ง PowerShell บรรทัดเดียวในการ Kill Process ที่ค้างอยู่บนพอร์ต 3000 ทันที"

### Prompt 8: Role-based Dashboards & Metrics Calculation (Issue 5)
> "เขียน Query สำหรับคำนวณ Metrics สรุปจำนวนตั๋วบน Staff Dashboard (Open, In Progress, Resolved) และ Requester Dashboard ที่กรองเฉพาะตั๋วที่เป็นของตนเอง พร้อมรองรับการ Search Keyword และ Filter ตาม Priority/Department"

### Prompt 9: Playwright End-to-End Test Suite (Issue 6)
> "สร้างไฟล์ Playwright E2E tests ใน `e2e/lab-04/ticket-resolution.spec.ts` เพื่อทดสอบ Flow การ Resolve ตั๋ว โดยตรวจสอบว่าหากยังไม่มี Action Taken จะไม่สามารถ Resolve ได้ และเมื่อบันทึก Action สำเร็จแล้วจึงสามารถเปลี่ยนสถานะเป็น Resolved ได้อย่างถูกต้อง"

### Prompt 10: Full Regression & Hardening Checklist (Issue 6)
> "ช่วยสร้าง Checklist สำหรับ Final Hardening ก่อนส่งงาน Lab 4 ตรวจสอบเรื่องการตัดขอบ Responsive บน Mobile, การดักจับ Console Errors, และการรัน Regression Tests ทั้งหมดของ Labs 1-4 ให้ผ่าน 100%"

---

## 3. My Reflection (การสะท้อนความคิดในการใช้งาน AI)

### การทำงานร่วมกับ AI ในฐานะ Specification Agent
ในการทำ Lab 4 การใช้ AI ช่วยวางโครงร่าง **Engineering Contract** และจำแนก **Business Rules (BR)** ล่วงหน้า ทำให้มองเห็นภาพรวมของระบบชัดเจนขึ้นมาก โดยเฉพาะเงื่อนไขความสัมพันธ์ที่ซับซ้อน เช่น ความเป็นเจ้าของตั๋ว (Ticket Owner) กับผู้บันทึกการปฏิบัติงาน (Action Performed By) ที่ไม่จำเป็นต้องเป็นคนเดียวกัน รวมถึงการออกแบบ **Resolution Gate** ที่ต้องบังคับใช้จากฝั่ง Backend API เสมอ ไม่ใช่เพียงแค่ซ่อนปุ่มบนหน้า UI ซึ่งหากไม่มีการกำหนด Acceptance Criteria (AC) ที่ชัดเจนร่วมกับ AI ตั้งแต่แรก อาจทำให้ลืมดักจับกรณีเหล่านี้และเกิดบั๊กในภายหลัง

### การทำงานร่วมกับ AI ในฐานะ Coding Agent
เมื่อนำ AI มาช่วยเขียนโค้ดและทดสอบ (TDD) พบว่า AI ช่วยลดเวลาในการเขียนโค้ดส่วน Boilerplate ได้เป็นอย่างดี เช่น การเขียนชุดทดสอบ API Integration Test และ React Component Test อย่างไรก็ตาม การพึ่งพา AI เพียงอย่างเดียวไม่สามารถแก้ปัญหาเชิง Environment ได้ ดังเช่นกรณีที่พบ Error `Property 'actionTaken' does not exist` ซึ่งเกิดจากการที่ Editor แคช Type Definition เก่าไว้ หรือการเกิดปัญหา `EADDRINUSE 3000` จากโปรเซสตกค้าง การแก้ปัญหาเหล่านี้จำเป็นต้องอาศัยความเข้าใจสถาปัตยกรรมของ Node.js, Prisma Client Compilation, และระบบปฏิบัติการจริง เพื่อวิเคราะห์และสั่งการได้อย่างถูกต้อง

### สรุปบทเรียนที่ได้รับ
AI เป็นเครื่องมือเร่งความเร็วที่ทรงพลังมากในกระบวนการพัฒนาซอฟต์แวร์ยุคใหม่ (Software Engineering in the Age of AI Agents) แต่ความรับผิดชอบในการตรวจสอบความถูกต้องของสถาปัตยกรรม, ความปลอดภัยของระบบการยืนยันสิทธิ์ (Authorization), และความเที่ยงตรงของผลลัพธ์ผ่าน Automated Tests ยังคงต้องควบคุมและตรวจสอบอย่างเคร่งครัดโดยวิศวกรผู้พัฒนา เพื่อให้ระบบที่ส่งมอบมีเสถียรภาพและตรงตามเกณฑ์ของวิศวกรรมซอฟต์แวร์อย่างแท้จริง
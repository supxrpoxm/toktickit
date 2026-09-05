# Lab 2: AI Use and Reflection

**LLM Used:** Gemini (และ OpenCode)

## Key Prompts
| Prompt Name | Prompt Text |
| :--- | :--- |
| 1. Generate Specs | "ช่วยแตก Issue ของ Lab 2 ออกเป็น 10 ข้อพร้อมระบุรายละเอียดของแต่ละ Issue ให้หน่อย" |
| 2. DB Schema | "ออกแบบ Prisma schema สำหรับ Requester, Ticket, และ Attachment ตามข้อกำหนดของ Lab 2" |
| 3. Create Ticket UI | "Implement only the Create Ticket screen and reusable Zen Green form components required by the current Issue." |
| 4. My Tickets | "สร้าง API และ UI สำหรับดึงรายการ Ticket ของผู้ใช้ที่เลือก พร้อมรองรับ Pagination และ Filter" |
| 5. Ticket Detail | "Implement the Requester Ticket Detail and Attachment lifecycle. Enforce ownership in the backend." |
| 6. Visual Checks | "Read `docs/lab-02/ui-spec.md` and implement Playwright test scripts to automatically capture screenshots for 3 viewports." |
| 7. Update Configs | "Update the README.md and .gitignore files to align with the Lab 2 sprint requirements." |
| 8. Responsive Fixes | "ปรับปรุง CSS ของหน้า Ticket Detail ให้แสดงผลแบบ Responsive บนหน้าจอ Mobile ตามข้อกำหนด Zen Green UI" |
| 9. Unit Testing | "เขียน Vitest สำหรับทดสอบ API Endpoint การสร้าง Ticket และตรวจสอบระบบ Validation ป้องกันข้อมูลผิดพลาด" |
| 10. Git Integration | "ช่วยตรวจสอบไฟล์ reviewer.md และสรุปขั้นตอนการทำ Release Pull Request เข้าสู่ Branch main" |

## My Reflection
การใช้ AI Agent ช่วยเพิ่มความรวดเร็วในการพัฒนาซอฟต์แวร์ได้อย่างก้าวกระโดด โดยเฉพาะการขึ้นโครงโปรเจกต์ การเขียน Boilerplate code และการสร้างเอกสารพื้นฐาน อย่างไรก็ตาม ความท้าทายที่สำคัญที่สุดคือ "การควบคุมขอบเขต (Scope Management)" เนื่องจาก AI มักจะเสนอระบบที่ซับซ้อนเกินความจำเป็น (Over-engineering) เช่น พยายามสร้างระบบ Login จริงๆ ขึ้นมาทั้งที่โจทย์กำหนดให้เป็นเพียงการจำลอง (Mock) การเรียนรู้ที่จะวางโครงสร้างสถาปัตยกรรมให้ชัดเจน ซอยงานออกเป็น Issue ย่อยๆ และการเขียน Prompt ที่ระบุข้อจำกัดอย่างรัดกุม จึงเป็นทักษะสำคัญที่ทำให้สามารถใช้งาน AI ได้อย่างมีประสิทธิภาพและตรงตามเป้าหมายของสเปกอย่างแท้จริง

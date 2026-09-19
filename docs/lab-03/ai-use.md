# Lab 3: AI Use and Reflection

**LLM Used:** Gemini and OpenCode

## Key Prompts
| Prompt Name | Prompt Text |
| :--- | :--- |
| 1. Generate Specs | "ช่วยสร้างเอกสาร specification.md และ API contract สำหรับ Lab 3 โดยเน้นเรื่อง Authentication และ Role-based access" |
| 2. DB Schema Update | "อัปเดต Prisma schema ให้รองรับ User Roles (Admin, IT Staff, Requester), IT Priority, และ Internal Notes" |
| 3. Auth Foundation | "Implement a secure login endpoint and mandatory first-login password change logic using JWT and bcrypt." |
| 4. IT Staff Queue | "สร้างหน้าจอ IT Staff Ticket Queue พร้อมระบบ Search, Filter และ Pagination อิงตาม Zen Green UI" |
| 5. Ticket Detail | "เขียน API สำหรับ Ticket Detail โดยต้องบังคับว่า Internal Notes สามารถเข้าถึงได้เฉพาะ IT Staff และ Admin เท่านั้น" |
| 6. Admin Management | "Implement the Administrator User Management screen. Ensure the backend blocks an Administrator from deactivating their own account." |
| 7. E2E Tests | "เขียน E2E Test ด้วย Playwright เพื่อทดสอบ flow การล็อกอินด้วยรหัสผ่านตั้งต้น แล้วบังคับเปลี่ยนรหัสผ่าน" |
| 8. Final Docs Prep | "ช่วยอัปเดตไฟล์ README.md และ reviewer.md ให้เป็นโครงสร้างมาตรฐานของโปรเจกต์" |

## My Reflection
ในการทำ Lab 3 สิ่งที่ได้เรียนรู้อย่างชัดเจนจากการทำงานร่วมกับ AI คือความสำคัญของการระบุกฎความปลอดภัย (Business/Security Rules) ที่ชัดเจนตั้งแต่ต้น เช่น "ห้าม Admin ปิดบัญชีตัวเอง" หรือ "ห้าม Requester เห็น Internal Notes" หากไม่ได้ระบุใน Prompt ให้ชัดเจน AI มักจะเขียนโค้ดที่ขาดความรัดกุม การใช้ Test-Driven Development (TDD) ร่วมกับการให้ AI ช่วยเขียนเทสต์ก่อนลงมือสร้างฟีเจอร์จริง ช่วยให้สามารถตีกรอบและควบคุมผลลัพธ์ของ AI ได้ดียิ่งขึ้น ทำให้แน่ใจว่าระบบ Role-based Authorization แข็งแกร่งตามเป้าหมาย

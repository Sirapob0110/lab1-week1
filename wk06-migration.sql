-- ปฏิบัติการสัปดาห์ที่ 6: รันสคริปต์นี้ต่อจาก schema.sql / seed.sql ของสัปดาห์ที่ 5
-- (ฐานข้อมูล student_api ต้องถูกสร้างไว้แล้ว)

USE student_api;

-- ขั้นตอนที่ 2.1: ตาราง users สำหรับ Authentication/RBAC
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- แบบฝึกหัดต่อยอดที่ 2: เพิ่มคอลัมน์เชื่อมโยง students <-> users
-- (เจตนาให้ NULL ได้ เพราะนักศึกษาที่ seed ไว้ตั้งแต่ W5 ยังไม่มีบัญชี login ผูกอยู่)
ALTER TABLE students ADD COLUMN user_id INT NULL;
ALTER TABLE students ADD FOREIGN KEY (user_id) REFERENCES users(id);

-- หลังจากสมัครสมาชิกผ่าน POST /api/v1/auth/register แล้ว (ดูขั้นตอนที่ 3.1 ใน wk06-lab.md)
-- ให้ผูกบัญชีเข้ากับนักศึกษาทดสอบด้วยตนเอง เช่น:
--   UPDATE students SET user_id = 1 WHERE id = 1;
-- (แทนที่ 1, 1 ด้วย id ของ users/students ที่ต้องการผูกจริง)

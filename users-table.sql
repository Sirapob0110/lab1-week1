-- ปฏิบัติการสัปดาห์ที่ 6 ขั้นตอนที่ 2.1
-- รันต่อจาก schema.sql ของสัปดาห์ที่ 5 (ฐานข้อมูล student_api ต้องถูกสร้างไว้แล้ว)

USE student_api;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

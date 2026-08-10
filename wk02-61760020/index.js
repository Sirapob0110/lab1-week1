require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

// ===================== ข้อมูลจำลอง (In-memory data) =====================
// จะถูกแทนที่ด้วย MySQL ในสัปดาห์ที่ 5
let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
    email: "somchai@buu.ac.th",
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
    email: "somying@buu.ac.th",
  },
  {
    id: 3,
    name: "วิชัย ตั้งใจ",
    major: "วิทยาการคอมพิวเตอร์",
    email: "wichai@buu.ac.th",
  },
];
let nextId = 4;

// ===================== Middleware (สัปดาห์ที่ 4) =====================
// ลำดับ middleware มีความสำคัญ: security header -> CORS -> logger -> body parser
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// แบบฝึกหัดที่ 1: ตรวจสอบ Content-Type สำหรับคำขอที่มี body
function requireJson(req, res, next) {
  const methodsWithBody = ["POST", "PUT", "PATCH"];
  if (
    methodsWithBody.includes(req.method) &&
    req.headers["content-type"] !== "application/json"
  ) {
    return res.status(415).json({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "กรุณาส่งข้อมูลในรูปแบบ application/json",
      },
    });
  }
  next();
}
app.use(requireJson);

// แบบฝึกหัดที่ 2: จำกัดจำนวนคำขอ (Rate Limiting) เฉพาะ POST /api/v1/students
// ติดตั้งแบบง่าย ไม่พึ่ง library ภายนอก เพื่อลดขั้นตอนการติดตั้งเพิ่มเติม
// (หากต้องการใช้ express-rate-limit ตามใบงาน ให้ npm install express-rate-limit
//  แล้วแทนที่ฟังก์ชันนี้ด้วย rateLimit({ windowMs: 60_000, max: 5, ... }))
const rateLimitStore = new Map();
function simpleRateLimit(req, res, next) {
  const windowMs = 60 * 1000;
  const max = 5;
  const key = req.ip;
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, start: now };

  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateLimitStore.set(key, entry);

  if (entry.count > max) {
    return res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "คำขอเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง",
      },
    });
  }
  next();
}

// ===================== Helper =====================
function findStudent(id) {
  return students.find((s) => s.id === Number(id));
}

// ===================== Routes =====================
const router = express.Router();

// GET /api/v1/students - ดึงรายชื่อนักศึกษาทั้งหมด
router.get("/students", (req, res) => {
  res.status(200).json({ data: students });
});

// GET /api/v1/students/:id - ดึงข้อมูลนักศึกษารายคน
router.get("/students/:id", (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) {
    return res.status(404).json({
      error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }
  res.status(200).json({ data: student });
});

// POST /api/v1/students - เพิ่มนักศึกษาใหม่
router.post("/students", simpleRateLimit, (req, res) => {
  const { name, major, email } = req.body || {};

  if (!name) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "กรุณาระบุชื่อ (name)" },
    });
  }

  // แบบฝึกหัดที่ 3: จำกัดความยาวของ name ไม่เกิน 100 ตัวอักษร
  if (typeof name === "string" && name.length > 100) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
      },
    });
  }

  if (email && students.some((s) => s.email === email)) {
    return res.status(409).json({
      error: { code: "EMAIL_ALREADY_EXISTS", message: "อีเมลนี้ถูกใช้งานแล้ว" },
    });
  }

  const newStudent = {
    id: nextId++,
    name,
    major: major || null,
    email: email || null,
  };
  students.push(newStudent);
  res.status(201).json({ data: newStudent });
});

// PUT /api/v1/students/:id - แก้ไขข้อมูลนักศึกษาแบบเต็ม
router.put("/students/:id", (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) {
    return res.status(404).json({
      error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  const { name, major, email } = req.body || {};
  if (!name) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "กรุณาระบุชื่อ (name)" },
    });
  }
  if (typeof name === "string" && name.length > 100) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
      },
    });
  }
  if (email && students.some((s) => s.email === email && s.id !== student.id)) {
    return res.status(409).json({
      error: { code: "EMAIL_ALREADY_EXISTS", message: "อีเมลนี้ถูกใช้งานแล้ว" },
    });
  }

  student.name = name;
  student.major = major || null;
  student.email = email || null;
  res.status(200).json({ data: student });
});

// PATCH /api/v1/students/:id - แก้ไขข้อมูลนักศึกษาบางส่วน
router.patch("/students/:id", (req, res) => {
  const student = findStudent(req.params.id);
  if (!student) {
    return res.status(404).json({
      error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  const { name, major, email } = req.body || {};

  if (name !== undefined) {
    if (!name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "ชื่อ (name) ห้ามเป็นค่าว่าง",
        },
      });
    }
    if (typeof name === "string" && name.length > 100) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
        },
      });
    }
    student.name = name;
  }

  if (email !== undefined) {
    if (students.some((s) => s.email === email && s.id !== student.id)) {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "อีเมลนี้ถูกใช้งานแล้ว",
        },
      });
    }
    student.email = email;
  }

  if (major !== undefined) {
    student.major = major;
  }

  res.status(200).json({ data: student });
});

// DELETE /api/v1/students/:id - ลบข้อมูลนักศึกษา
router.delete("/students/:id", (req, res) => {
  const index = students.findIndex((s) => s.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({
      error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }
  students.splice(index, 1);
  res.status(204).send();
});

app.use("/api/v1", router);

// ===================== 404: ไม่พบ route ที่ร้องขอ =====================
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// ===================== Error-handling middleware (ต้องอยู่ท้ายสุดเสมอ) =====================
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});

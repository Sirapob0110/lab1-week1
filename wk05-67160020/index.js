require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

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

// แบบฝึกหัดที่ 1 (W4): ตรวจสอบ Content-Type สำหรับคำขอที่มี body
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

// แบบฝึกหัดที่ 2 (W4): จำกัดจำนวนคำขอ (Rate Limiting) เฉพาะ POST /api/v1/students
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

// ===================== Routes (สัปดาห์ที่ 5: ย้ายไปใช้ MySQL) =====================
const router = express.Router();

// GET /api/v1/students - ดึงรายชื่อนักศึกษาทั้งหมด
router.get("/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");
    res.status(200).json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/students/:id - ดึงข้อมูลนักศึกษารายคน
router.get("/students/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }
    res.status(200).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/students/:id/courses - แบบฝึกหัดต่อยอดที่ 1: JOIN
router.get("/students/:id/courses", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT courses.* FROM courses
       JOIN enrollments ON courses.id = enrollments.course_id
       WHERE enrollments.student_id = ?`,
      [req.params.id],
    );
    res.status(200).json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/students - เพิ่มนักศึกษาใหม่
router.post("/students", simpleRateLimit, async (req, res, next) => {
  const { name, major, email } = req.body || {};

  if (!name) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "กรุณาระบุชื่อ (name)" },
    });
  }

  // แบบฝึกหัดที่ 3 (W4): จำกัดความยาวของ name ไม่เกิน 100 ตัวอักษร
  if (typeof name === "string" && name.length > 100) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major || null, email || null],
    );
    res.status(201).json({
      data: {
        id: result.insertId,
        name,
        major: major || null,
        email: email || null,
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "อีเมลนี้ถูกใช้งานแล้ว",
        },
      });
    }
    next(err);
  }
});

// PUT /api/v1/students/:id - แก้ไขข้อมูลนักศึกษาแบบเต็ม
router.put("/students/:id", async (req, res, next) => {
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

  try {
    const [existing] = await pool.query(
      "SELECT id FROM students WHERE id = ?",
      [req.params.id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }

    await pool.query(
      "UPDATE students SET name = ?, major = ?, email = ? WHERE id = ?",
      [name, major || null, email || null, req.params.id],
    );
    res.status(200).json({
      data: {
        id: Number(req.params.id),
        name,
        major: major || null,
        email: email || null,
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "อีเมลนี้ถูกใช้งานแล้ว",
        },
      });
    }
    next(err);
  }
});

// PATCH /api/v1/students/:id - แก้ไขข้อมูลนักศึกษาบางส่วน
router.patch("/students/:id", async (req, res, next) => {
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
  }

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM students WHERE id = ?",
      [req.params.id],
    );
    if (existingRows.length === 0) {
      return res.status(404).json({
        error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }
    const current = existingRows[0];

    const updated = {
      name: name !== undefined ? name : current.name,
      major: major !== undefined ? major : current.major,
      email: email !== undefined ? email : current.email,
    };

    await pool.query(
      "UPDATE students SET name = ?, major = ?, email = ? WHERE id = ?",
      [updated.name, updated.major, updated.email, req.params.id],
    );
    res.status(200).json({ data: { id: Number(req.params.id), ...updated } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "อีเมลนี้ถูกใช้งานแล้ว",
        },
      });
    }
    next(err);
  }
});

// DELETE /api/v1/students/:id - ลบข้อมูลนักศึกษา
router.delete("/students/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM students WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: { code: "STUDENT_NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/students/:id/enrollments - ลงทะเบียนเรียนด้วย Transaction (ขั้นตอนที่ 3.3)
router.post("/students/:id/enrollments", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body || {};
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [courseRows] = await connection.query(
      "SELECT * FROM courses WHERE id = ? FOR UPDATE",
      [courseId],
    );

    if (courseRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      await connection.rollback();
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    await connection.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    await connection.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    await connection.commit();
    res.status(201).json({ message: "ลงทะเบียนสำเร็จ" });
  } catch (err) {
    await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นักศึกษาลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  } finally {
    connection.release();
  }
});

// POST /api/v1/students/:id/enrollments-unsafe - แบบฝึกหัดต่อยอดที่ 2: ลงทะเบียนแบบไม่ใช้ Transaction
// ⚠️ จงใจไม่ใช้ beginTransaction/commit/rollback เพื่อสังเกตความเสี่ยงเรื่อง data inconsistency
// หากเกิดข้อผิดพลาดระหว่าง INSERT กับ UPDATE (เช่น เครื่อง server ล่ม, connection หลุด, error อื่นๆ
// ที่ไม่ใช่ constraint violation) จะได้ enrollments ที่ไม่มี seat ถูกหักออกจริง (INSERT สำเร็จแต่ UPDATE ไม่ทำงาน)
// ทำให้ seat_available ในฐานข้อมูลไม่ตรงกับจำนวนที่นั่งที่ถูกจองจริง (นับที่นั่งผิด อาจให้คนลงทะเบียนเกินจำนวนที่มี)
router.post("/students/:id/enrollments-unsafe", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body || {};

  try {
    const [courseRows] = await pool.query(
      "SELECT * FROM courses WHERE id = ?",
      [courseId],
    );

    if (courseRows.length === 0) {
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    // ไม่มี transaction ครอบ: ถ้า process ตาย/error เกิดขึ้นระหว่างสองคำสั่งนี้
    // INSERT จะสำเร็จไปแล้วแต่ UPDATE จะไม่ถูกรัน -> ข้อมูลไม่สอดคล้องกัน (inconsistent)
    await pool.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    await pool.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    res
      .status(201)
      .json({ message: "ลงทะเบียนสำเร็จ (unsafe - ไม่มี transaction)" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นักศึกษาลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  }
});

// DELETE /api/v1/students/:id/enrollments/:courseId - แบบฝึกหัดต่อยอดที่ 3: ยกเลิกการลงทะเบียนด้วย Transaction
router.delete("/students/:id/enrollments/:courseId", async (req, res, next) => {
  const { id: studentId, courseId } = req.params;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      "DELETE FROM enrollments WHERE student_id = ? AND course_id = ?",
      [studentId, courseId],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: {
          code: "ENROLLMENT_NOT_FOUND",
          message: "ไม่พบการลงทะเบียนนี้",
        },
      });
    }

    await connection.query(
      "UPDATE courses SET seat_available = seat_available + 1 WHERE id = ?",
      [courseId],
    );

    await connection.commit();
    res.status(200).json({ message: "ยกเลิกการลงทะเบียนสำเร็จ" });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
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

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mock Data
let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
  },
];

let nextId = 3;

// หน้าแรก
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Student API พร้อมใช้งาน",
  });
});

// GET ALL
app.get("/api/v1/students", (req, res) => {
  res.status(200).json({
    message: "สำเร็จ",
    data: students,
  });
});

// GET BY ID
app.get("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      message: "ไม่พบข้อมูลนักศึกษา",
    });
  }

  res.status(200).json({
    message: "สำเร็จ",
    data: student,
  });
});

// POST
app.post("/api/v1/students", (req, res) => {
  const { name, major } = req.body;

  if (!name || !major) {
    return res.status(400).json({
      message: "กรุณาระบุ name และ major ให้ครบถ้วน",
    });
  }

  const newStudent = {
    id: nextId++,
    name,
    major,
  };

  students.push(newStudent);

  res.status(201).json({
    message: "เพิ่มข้อมูลสำเร็จ",
    data: newStudent,
  });
});

// PUT
app.put("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const { name, major } = req.body;

  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      message: "ไม่พบข้อมูลนักศึกษา",
    });
  }

  if (!name || !major) {
    return res.status(400).json({
      message: "กรุณาระบุ name และ major ให้ครบถ้วน",
    });
  }

  student.name = name;
  student.major = major;

  res.status(200).json({
    message: "แก้ไขข้อมูลสำเร็จ",
    data: student,
  });
});

// DELETE
app.delete("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({
      message: "ไม่พบข้อมูลนักศึกษา",
    });
  }

  students.splice(index, 1);

  res.status(200).json({
    message: "ลบข้อมูลสำเร็จ",
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
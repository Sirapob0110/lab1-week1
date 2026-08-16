const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const root = require("./resolvers");

const app = express();
app.use(express.json());

// ---------- ข้อมูลจำลองสำหรับฝั่ง REST ----------
let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
    email: "somchai@example.com",
    phone: "080-000-0001",
    courseIds: [101, 102],
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
    email: "somying@example.com",
    phone: "080-000-0002",
    courseIds: [102],
  },
];

let courses = [
  { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
  { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
];

let nextId = 3;

// ---------- GET นักศึกษาทั้งหมด ----------
app.get("/api/v1/students", (req, res) => {
  res.status(200).json({
    message: "สำเร็จ",
    data: students,
  });
});

// ---------- GET นักศึกษาตาม id (รองรับ include=courses) ----------
app.get("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบข้อมูลนักศึกษา",
      },
    });
  }

  const includeCourses = req.query.include === "courses";

  if (includeCourses) {
    const studentCourses = courses.filter((c) =>
      student.courseIds.includes(c.id),
    );

    return res.status(200).json({
      message: "สำเร็จ",
      data: {
        ...student,
        courses: studentCourses,
      },
    });
  }

  res.status(200).json({
    message: "สำเร็จ",
    data: student,
  });
});

// ---------- POST เพิ่มนักศึกษา ----------
app.post("/api/v1/students", (req, res) => {
  const { name, major, email, phone } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  const duplicated = students.find((s) => s.email === email);

  if (duplicated) {
    return res.status(409).json({
      error: {
        code: "DUPLICATE_EMAIL",
        message: "อีเมลนี้มีอยู่ในระบบแล้ว",
      },
    });
  }

  const newStudent = {
    id: nextId++,
    name,
    major,
    email,
    phone: phone || "",
    courseIds: [],
  };

  students.push(newStudent);

  res.status(201).json({
    message: "เพิ่มข้อมูลสำเร็จ",
    data: newStudent,
  });
});

// ---------- PATCH แก้ไขข้อมูลบางส่วน ----------
app.patch("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบข้อมูลนักศึกษา",
      },
    });
  }

  const { name, major, email, phone } = req.body;

  if (name !== undefined) student.name = name;
  if (major !== undefined) student.major = major;
  if (email !== undefined) student.email = email;
  if (phone !== undefined) student.phone = phone;

  res.status(200).json({
    message: "แก้ไขข้อมูลสำเร็จ",
    data: student,
  });
});

// ---------- GET รายวิชา ----------
app.get("/api/v1/courses/:id", (req, res) => {
  const id = Number(req.params.id);

  const course = courses.find((c) => c.id === id);

  if (!course) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบข้อมูลรายวิชา",
      },
    });
  }

  res.status(200).json({
    message: "สำเร็จ",
    data: course,
  });
});

// ---------- GraphQL ----------
app.use(
  "/graphql",
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  }),
);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
  console.log(`GraphiQL: http://localhost:${PORT}/graphql`);
});

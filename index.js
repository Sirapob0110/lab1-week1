const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const root = require("./resolvers");

const app = express();
app.use(express.json());

// ---------- ข้อมูลจำลองสำหรับฝั่ง REST (แยกจาก GraphQL ตามที่เอกสารแล็บกำหนด) ----------
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

// ---------- REST endpoints (จากสัปดาห์ที่ 1) ----------
app.get("/api/v1/students", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: students });
});

app.get("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }
  res.status(200).json({ message: "สำเร็จ", data: student });
});

app.get("/api/v1/courses/:id", (req, res) => {
  const id = Number(req.params.id);
  const course = courses.find((c) => c.id === id);
  if (!course) {
    return res.status(404).json({ message: "ไม่พบข้อมูลรายวิชา" });
  }
  res.status(200).json({ message: "สำเร็จ", data: course });
});

// ---------- ขั้นตอนที่ 2.2: endpoint ที่คืนข้อมูลนักศึกษาพร้อมรายวิชา (over-fetching demo) ----------
app.get("/api/v1/students/:id/full", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  const studentCourses = courses.filter((c) =>
    student.courseIds.includes(c.id),
  );

  res.status(200).json({
    message: "สำเร็จ",
    data: { ...student, courses: studentCourses },
  });
});

// ---------- ขั้นตอนที่ 3.4: เชื่อมต่อ GraphQL เข้ากับ Express ----------
app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true, // เปิดใช้งานหน้าทดสอบ GraphiQL ผ่านเบราว์เซอร์
  }),
);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
  console.log(`GraphiQL: http://localhost:${PORT}/graphql`);
});

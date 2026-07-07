const express = require("express");
const studentsRouter = require("./routes/students");
const coursesRouter = require("./routes/courses");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งาน" });
});

app.use("/api/v1/students", studentsRouter);
app.use("/api/v1/courses", coursesRouter);

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});
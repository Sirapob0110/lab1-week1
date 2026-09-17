
const request = require("supertest");

jest.mock("../db", () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const pool = require("../db");
const app = require("../app");
const jwt = require("jsonwebtoken");

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_EXPIRES_IN = "1h";
});

const makeToken = (user) =>
  jwt.sign(user, process.env.JWT_SECRET);

describe("Students API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/students", () => {
    it("ควรดึงรายชื่อนักศึกษาสำเร็จ", async () => {
      const students = [
        { id: 1, name: "สมชาย", major: "IT", email: "somchai@example.com" },
        { id: 2, name: "สมหญิง", major: "CS", email: "somying@example.com" },
      ];

      pool.query.mockResolvedValueOnce([students]);

      const response = await request(app).get("/api/v1/students");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(students);
    });
  });

  describe("GET /api/v1/students/:id", () => {
    it("ควรดึงข้อมูลนักศึกษารายคนสำเร็จ", async () => {
      const student = {
        id: 1,
        name: "สมชาย",
        major: "IT",
        email: "somchai@example.com",
      };

      pool.query.mockResolvedValueOnce([[student]]);

      const response = await request(app).get("/api/v1/students/1");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(student);
    });

    it("ควรตอบ 404 เมื่อไม่พบข้อมูลนักศึกษา", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app).get("/api/v1/students/999");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("STUDENT_NOT_FOUND");
    });
  });

  describe("POST /api/v1/students", () => {
    it("ควรเพิ่มนักศึกษาใหม่สำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 3 }]);

      const response = await request(app)
        .post("/api/v1/students")
        .send({
          name: "สมปอง",
          major: "IT",
          email: "sompong@example.com",
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({
        id: 3,
        name: "สมปอง",
        major: "IT",
        email: "sompong@example.com",
      });
    });

    it("ควรตอบ 400 เมื่อไม่ได้ส่งชื่อ", async () => {
      const response = await request(app)
        .post("/api/v1/students")
        .send({ major: "IT" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("ควรตอบ 400 เมื่อชื่อยาวเกิน 100 ตัวอักษร", async () => {
      const response = await request(app)
        .post("/api/v1/students")
        .send({ name: "ก".repeat(101) });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("ควรตอบ 409 เมื่ออีเมลซ้ำ", async () => {
      pool.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

      const response = await request(app)
        .post("/api/v1/students")
        .send({
          name: "สมปอง",
          email: "duplicate@example.com",
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });
  });

  describe("PUT /api/v1/students/:id", () => {
    it("ควรตอบ 401 เมื่อไม่ได้ส่ง token", async () => {
      const response = await request(app)
        .put("/api/v1/students/1")
        .send({ name: "ชื่อใหม่" });

      expect(response.status).toBe(401);
    });

    it("ควรตอบ 403 เมื่อไม่ใช่เจ้าของและไม่ใช่ admin", async () => {
      const token = makeToken({ id: 2, role: "student" });
      pool.query.mockResolvedValueOnce([[{ id: 1, user_id: 1 }]]);

      const response = await request(app)
        .put("/api/v1/students/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "ชื่อใหม่" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("ควรแก้ไขข้อมูลได้เมื่อเป็นเจ้าของ", async () => {
      const token = makeToken({ id: 1, role: "student" });

      pool.query
        .mockResolvedValueOnce([[{ id: 1, user_id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put("/api/v1/students/1")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "ชื่อใหม่",
          major: "IT",
          email: "new@example.com",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe("ชื่อใหม่");
    });

    it("ควรตอบ 404 เมื่อไม่พบข้อมูล", async () => {
      const token = makeToken({ id: 1, role: "student" });
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .put("/api/v1/students/999")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "ชื่อใหม่" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("STUDENT_NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/students/:id", () => {
    it("ควรแก้ไขเฉพาะข้อมูลที่ส่งมา", async () => {
      pool.query
        .mockResolvedValueOnce([[
          {
            id: 1,
            name: "สมชาย",
            major: "IT",
            email: "old@example.com",
          },
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .patch("/api/v1/students/1")
        .send({ name: "สมชายใหม่" });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        id: 1,
        name: "สมชายใหม่",
        major: "IT",
        email: "old@example.com",
      });
    });

    it("ควรตอบ 404 เมื่อไม่พบข้อมูล", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .patch("/api/v1/students/999")
        .send({ name: "ชื่อใหม่" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("STUDENT_NOT_FOUND");
    });

    it("ควรตอบ 400 เมื่อส่งชื่อว่าง", async () => {
      const response = await request(app)
        .patch("/api/v1/students/1")
        .send({ name: "" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("DELETE /api/v1/students/:id", () => {
    it("ควรตอบ 401 เมื่อไม่ได้ส่ง token", async () => {
      const response = await request(app).delete("/api/v1/students/1");

      expect(response.status).toBe(401);
    });

    it("ควรตอบ 403 เมื่อเป็น student", async () => {
      const token = makeToken({ id: 1, role: "student" });

      const response = await request(app)
        .delete("/api/v1/students/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("ควรลบข้อมูลได้เมื่อเป็น admin", async () => {
      const token = makeToken({ id: 1, role: "admin" });
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .delete("/api/v1/students/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(204);
    });

    it("ควรตอบ 404 เมื่อ admin ลบข้อมูลที่ไม่มีอยู่", async () => {
      const token = makeToken({ id: 1, role: "admin" });
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const response = await request(app)
        .delete("/api/v1/students/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("STUDENT_NOT_FOUND");
    });
  });
});
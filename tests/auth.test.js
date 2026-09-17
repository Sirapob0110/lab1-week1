
const request = require("supertest");

jest.mock("../db", () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const pool = require("../db");
const app = require("../app");
const { hashPassword } = require("../auth-helpers");

describe("Authentication API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("ควรสมัครสมาชิกสำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "student@example.com",
          password: "password123",
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("สมัครสมาชิกสำเร็จ");
      expect(response.body.data).toEqual({
        id: 1,
        email: "student@example.com",
        role: "student",
      });
    });

    it("ควรตอบ 400 เมื่อไม่ได้ส่ง email หรือ password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "student@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("ควรตอบ 409 เมื่ออีเมลซ้ำ", async () => {
      pool.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "student@example.com",
          password: "password123",
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("DUPLICATE_EMAIL");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("ควรล็อกอินสำเร็จและได้รับ token", async () => {
      const passwordHash = await hashPassword("password123");

      pool.query.mockResolvedValueOnce([
        [{
          id: 1,
          email: "student@example.com",
          password_hash: passwordHash,
          role: "student",
        }],
      ]);

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "student@example.com",
          password: "password123",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("เข้าสู่ระบบสำเร็จ");
      expect(response.body.token).toBeTruthy();
    });

    it("ควรตอบ 401 เมื่อไม่พบอีเมล", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "missing@example.com",
          password: "password123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("ควรตอบ 400 เมื่อไม่ได้ส่งข้อมูลครบ", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "student@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
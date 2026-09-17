const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("../auth-helpers");

const jwt = require("jsonwebtoken");

describe("auth-helpers", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "1h";
  });

  describe("hashPassword", () => {
    it("ควรแฮชรหัสผ่านได้", async () => {
      const password = "password123";

      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toBeTruthy();
    });
  });

  describe("verifyPassword", () => {
    it("ควรคืนค่า true เมื่อรหัสผ่านถูกต้อง", async () => {
      const password = "password123";
      const hashedPassword = await hashPassword(password);

      const result = await verifyPassword(password, hashedPassword);

      expect(result).toBe(true);
    });

    it("ควรคืนค่า false เมื่อรหัสผ่านไม่ถูกต้อง", async () => {
      const hashedPassword = await hashPassword("password123");

      const result = await verifyPassword("wrong-password", hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe("generateToken", () => {
    it("ควรสร้าง JWT ที่มีข้อมูลผู้ใช้", () => {
      const user = {
        id: 1,
        email: "student@example.com",
        role: "student",
      };

      const token = generateToken(user);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });
  });
});
jest.mock("../db", () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const request = require("supertest");
const pool = require("../db");
const app = require("../app");
const { hashPassword } = require("../auth-helpers");

function createMockConnection() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
}

afterEach(() => {
  // resetAllMocks ล้างทั้งประวัติการเรียกและคิว mockResolvedValueOnce/
  // mockRejectedValueOnce ที่ยังไม่ถูกใช้ ป้องกัน mock รั่วข้าม test
  // (ต่างจาก clearAllMocks ที่ล้างแค่ประวัติการเรียก แต่คิวยังค้างอยู่)
  jest.resetAllMocks();
});

// ---------------------------------------------------------------
// บรรทัด 37: requireJson middleware - กรณี Content-Type ไม่ใช่ JSON
// ---------------------------------------------------------------
describe("requireJson middleware", () => {
  it("ควรตอบ 415 เมื่อ Content-Type ไม่ใช่ application/json", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .set("Content-Type", "text/plain")
      .send("not json");

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});

// ---------------------------------------------------------------
// บรรทัด 58-59, 65: simpleRateLimit middleware - reset window และ 429
// ---------------------------------------------------------------
describe("simpleRateLimit middleware", () => {
  it("ควรตอบ 429 เมื่อยิง POST /students เกิน 5 ครั้งภายใน 1 นาที", async () => {
    pool.query.mockResolvedValue([{ insertId: 1 }]);

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/students")
        .send({ name: `นักศึกษา ${i}` });
    }

    const response = await request(app)
      .post("/api/v1/students")
      .send({ name: "นักศึกษาคนที่ 6" });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("ควร reset ตัวนับเมื่อเวลาผ่านไปเกิน 1 นาที (บรรทัด 58-59)", async () => {
    pool.query.mockResolvedValue([{ insertId: 1 }]);
    const realDateNow = Date.now.bind(global.Date);

    let now = realDateNow();
    jest.spyOn(Date, "now").mockImplementation(() => now);

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/students")
        .send({ name: `นักศึกษา ${i}` });
    }
    // เลื่อนเวลาไปข้างหน้า 61 วินาที เพื่อให้ window เดิมหมดอายุ
    now += 61 * 1000;

    const response = await request(app)
      .post("/api/v1/students")
      .send({ name: "นักศึกษาหลัง reset" });

    expect(response.status).toBe(201);
    Date.now.mockRestore();
  });
});

// ---------------------------------------------------------------
// บรรทัด 110: POST /auth/register - error อื่นที่ไม่ใช่ ER_DUP_ENTRY
// ---------------------------------------------------------------
describe("POST /api/v1/auth/register - unexpected error", () => {
  it("ควรตอบ 500 เมื่อฐานข้อมูล error แบบไม่คาดคิด", async () => {
    pool.query.mockRejectedValueOnce(new Error("Unexpected DB failure"));

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "x@example.com", password: "password123" });

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------
// บรรทัด 145: POST /auth/login - รหัสผ่านผิด (คนละ branch กับ "ไม่พบอีเมล")
// ---------------------------------------------------------------
describe("POST /api/v1/auth/login - wrong password", () => {
  it("ควรตอบ 401 เมื่อพบอีเมลแต่รหัสผ่านผิด", async () => {
    const correctHash = await hashPassword("correctPassword");
    pool.query.mockResolvedValueOnce([
      [{ id: 1, email: "x@example.com", password_hash: correctHash, role: "student" }],
    ]);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "x@example.com", password: "wrongPassword" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

// ---------------------------------------------------------------
// บรรทัด 170-215: PATCH /auth/change-password - ทั้ง route ยังไม่เคยถูกทดสอบ
// ---------------------------------------------------------------
describe("PATCH /api/v1/auth/change-password", () => {
  async function getToken() {
    const hash = await hashPassword("oldPassword123");
    pool.query.mockResolvedValueOnce([
      [{ id: 1, email: "x@example.com", password_hash: hash, role: "student" }],
    ]);
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "x@example.com", password: "oldPassword123" });
    return loginRes.body.token;
  }

  it("ควรตอบ 401 เมื่อไม่แนบ token", async () => {
    const response = await request(app)
      .patch("/api/v1/auth/change-password")
      .send({ oldPassword: "a", newPassword: "b" });

    expect(response.status).toBe(401);
  });

  it("ควรตอบ 400 เมื่อไม่ส่ง oldPassword/newPassword", async () => {
    const token = await getToken();

    const response = await request(app)
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ควรตอบ 404 เมื่อไม่พบผู้ใช้ในระบบ", async () => {
    const token = await getToken();
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: "a", newPassword: "b" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("ควรตอบ 401 เมื่อ oldPassword ไม่ถูกต้อง", async () => {
    const token = await getToken();
    const hash = await hashPassword("oldPassword123");
    pool.query.mockResolvedValueOnce([
      [{ id: 1, email: "x@example.com", password_hash: hash }],
    ]);

    const response = await request(app)
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: "wrongOld", newPassword: "newPass123" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("ควรตอบ 200 เมื่อเปลี่ยนรหัสผ่านสำเร็จ", async () => {
    const token = await getToken();
    const hash = await hashPassword("oldPassword123");
    pool.query.mockResolvedValueOnce([
      [{ id: 1, email: "x@example.com", password_hash: hash }],
    ]);
    pool.query.mockResolvedValueOnce([{}]); // UPDATE

    const response = await request(app)
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: "oldPassword123", newPassword: "newPass123" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("เปลี่ยนรหัสผ่านสำเร็จ");
  });
});

// ---------------------------------------------------------------
// บรรทัด 226, 244: GET /students, GET /students/:id - catch(err) -> next(err)
// ---------------------------------------------------------------
describe("GET /api/v1/students - database error", () => {
  it("ควรตอบ 500 เมื่อ query ล้มเหลว", async () => {
    pool.query.mockRejectedValueOnce(new Error("Connection lost"));
    const response = await request(app).get("/api/v1/students");
    expect(response.status).toBe(500);
  });
});

describe("GET /api/v1/students/:id - database error", () => {
  it("ควรตอบ 500 เมื่อ query ล้มเหลว", async () => {
    pool.query.mockRejectedValueOnce(new Error("Connection lost"));
    const response = await request(app).get("/api/v1/students/1");
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------
// บรรทัด 250-259: GET /students/:id/courses - ทั้ง route ยังไม่เคยถูกทดสอบ
// ---------------------------------------------------------------
describe("GET /api/v1/students/:id/courses", () => {
  it("ควรตอบ 200 พร้อมรายวิชาที่ลงทะเบียน", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, course_name: "Test" }]]);
    const response = await request(app).get("/api/v1/students/1/courses");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it("ควรตอบ 500 เมื่อ query ล้มเหลว", async () => {
    pool.query.mockRejectedValueOnce(new Error("Connection lost"));
    const response = await request(app).get("/api/v1/students/1/courses");
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------
// บรรทัด 305: POST /students - error อื่นที่ไม่ใช่ ER_DUP_ENTRY
// ---------------------------------------------------------------
describe("POST /api/v1/students - unexpected error", () => {
  it("ควรตอบ 500 เมื่อฐานข้อมูล error แบบไม่คาดคิด", async () => {
    pool.query.mockRejectedValueOnce(new Error("Unexpected DB failure"));
    const response = await request(app)
      .post("/api/v1/students")
      .send({ name: "ทดสอบ" });
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------
// บรรทัด 315, 320, 363-371: PUT /students/:id - validation + duplicate email
// ---------------------------------------------------------------
describe("PUT /api/v1/students/:id - validation and errors", () => {
  async function getToken(role = "admin") {
    const hash = await hashPassword("pass123");
    pool.query.mockResolvedValueOnce([[{ id: 1, email: "a@a.com", password_hash: hash, role }]]);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@a.com", password: "pass123" });
    return res.body.token;
  }

  it("ควรตอบ 400 เมื่อไม่ส่งชื่อ (บรรทัด 315)", async () => {
    const token = await getToken();
    const response = await request(app)
      .put("/api/v1/students/1")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it("ควรตอบ 400 เมื่อชื่อยาวเกิน 100 ตัวอักษร (บรรทัด 320)", async () => {
    const token = await getToken();
    const response = await request(app)
      .put("/api/v1/students/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "ก".repeat(101) });
    expect(response.status).toBe(400);
  });

  it("ควรตอบ 409 เมื่ออีเมลซ้ำ (บรรทัด 363-371)", async () => {
    const token = await getToken();
    pool.query.mockResolvedValueOnce([[{ id: 1, user_id: null }]]); // SELECT existing
    pool.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" }); // UPDATE

    const response = await request(app)
      .put("/api/v1/students/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "ชื่อใหม่", email: "dup@example.com" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});

// ---------------------------------------------------------------
// บรรทัด 389, 422-430: PATCH /students/:id - validation + duplicate email
// ---------------------------------------------------------------
describe("PATCH /api/v1/students/:id - validation and errors", () => {
  it("ควรตอบ 400 เมื่อส่งชื่อเป็นค่าว่าง (บรรทัด 389)", async () => {
    // ไม่ต้อง mock pool.query เลย เพราะ validation ตรวจ "!name" ก่อนแตะ DB
    const response = await request(app)
      .patch("/api/v1/students/1")
      .send({ name: "" });
    expect(response.status).toBe(400);
  });

  it("ควรตอบ 409 เมื่ออีเมลซ้ำ (บรรทัด 422-430)", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, name: "เดิม", major: "IT", email: "a@a.com" }]]);
    pool.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

    const response = await request(app)
      .patch("/api/v1/students/1")
      .send({ email: "dup@example.com" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});

// ---------------------------------------------------------------
// บรรทัด 451: DELETE /students/:id - catch(err) -> next(err)
// ---------------------------------------------------------------
describe("DELETE /api/v1/students/:id - database error", () => {
  it("ควรตอบ 500 เมื่อ query ล้มเหลว", async () => {
    const hash = await hashPassword("pass123");
    pool.query.mockResolvedValueOnce([[{ id: 1, email: "a@a.com", password_hash: hash, role: "admin" }]]);
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@a.com", password: "pass123" });

    pool.query.mockRejectedValueOnce(new Error("Connection lost"));

    const response = await request(app)
      .delete("/api/v1/students/1")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------
// บรรทัด 506: POST /students/:id/enrollments - error อื่นระหว่าง transaction
// ---------------------------------------------------------------
describe("POST /api/v1/students/:id/enrollments - unexpected error", () => {
  it("ควรตอบ 500 และ rollback เมื่อเกิด error ที่ไม่ใช่ ER_DUP_ENTRY", async () => {
    const connection = createMockConnection();
    connection.query.mockRejectedValueOnce(new Error("Unexpected DB failure"));
    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments")
      .send({ courseId: 1 });

    expect(response.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------
// บรรทัด 518-563: POST /students/:id/enrollments-unsafe - ทั้ง route ยังไม่เคยถูกทดสอบ
// ---------------------------------------------------------------
describe("POST /api/v1/students/:id/enrollments-unsafe", () => {
  it("ควรตอบ 201 เมื่อลงทะเบียนสำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, seat_available: 5 }]]);
    pool.query.mockResolvedValueOnce([{}]);
    pool.query.mockResolvedValueOnce([{}]);

    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });

    expect(response.status).toBe(201);
  });

  it("ควรตอบ 404 เมื่อไม่พบวิชา", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 999 });
    expect(response.status).toBe(404);
  });

  it("ควรตอบ 409 เมื่อที่นั่งเต็ม", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, seat_available: 0 }]]);
    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SEAT_FULL");
  });

  it("ควรตอบ 409 เมื่อลงทะเบียนซ้ำ", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, seat_available: 5 }]]);
    pool.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
    const response = await request(app)
      .post("/api/v1/students/1/enrollments-unsafe")
      .send({ courseId: 1 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ALREADY_ENROLLED");
  });
});

// ---------------------------------------------------------------
// บรรทัด 598-599: DELETE /students/:id/enrollments/:courseId - error ระหว่าง transaction
// ---------------------------------------------------------------
describe("DELETE /api/v1/students/:id/enrollments/:courseId - unexpected error", () => {
  it("ควรตอบ 500 และ rollback เมื่อเกิด error", async () => {
    const connection = createMockConnection();
    connection.query.mockRejectedValueOnce(new Error("Unexpected DB failure"));
    pool.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app).delete(
      "/api/v1/students/1/enrollments/1",
    );

    expect(response.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------
// บรรทัด 609: 404 ROUTE_NOT_FOUND handler
// ---------------------------------------------------------------
describe("Unknown route", () => {
  it("ควรตอบ 404 ROUTE_NOT_FOUND สำหรับ route ที่ไม่มีอยู่จริง", async () => {
    const response = await request(app).get("/api/v1/this-route-does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});
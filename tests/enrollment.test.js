
const request = require("supertest");

jest.mock("../db", () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

const pool = require("../db");
const app = require("../app");

describe("Enrollment API", () => {
  let connection;

  beforeEach(() => {
    jest.clearAllMocks();

    connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValue(connection);
  });

  describe("POST /api/v1/students/:id/enrollments", () => {
    it("should enroll student successfully", async () => {
      connection.query
        .mockResolvedValueOnce([[{ id: 10, seat_available: 3 }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ course_id: 10 });

      expect(res.statusCode).toBe(201);
      expect(connection.beginTransaction).toHaveBeenCalled();
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    it("should return 404 when course does not exist", async () => {
      connection.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ course_id: 999 });

      expect(res.statusCode).toBe(404);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    it("should return 409 when no seats are available", async () => {
      connection.query.mockResolvedValueOnce([
        [{ id: 10, seat_available: 0 }],
      ]);

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ course_id: 10 });

      expect(res.statusCode).toBe(409);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    it("should return 409 when student is already enrolled", async () => {
      connection.query
        .mockResolvedValueOnce([[{ id: 10, seat_available: 3 }]])
        .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

      const res = await request(app)
        .post("/api/v1/students/1/enrollments")
        .send({ course_id: 10 });

      expect(res.statusCode).toBe(409);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/v1/students/:id/enrollments/:courseId", () => {
    it("should cancel enrollment successfully", async () => {
      connection.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{}]);

      const res = await request(app)
        .delete("/api/v1/students/1/enrollments/10");

      expect(res.statusCode).toBe(200);
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    it("should return 404 when enrollment does not exist", async () => {
      connection.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const res = await request(app)
        .delete("/api/v1/students/1/enrollments/999");

      expect(res.statusCode).toBe(404);
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });
  });
});
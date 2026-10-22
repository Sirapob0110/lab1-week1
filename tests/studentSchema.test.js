const { studentSchema } = require("../schemas/studentSchema");

describe("Lab 12 student schema", () => {
  test("accepts a regular student without passportNumber", () => {
    expect(studentSchema.safeParse({ name: "Somchai", major: "IT", email: "somchai@example.com" }).success).toBe(true);
  });
  test("requires passportNumber for International majors", () => {
    const result = studentSchema.safeParse({ name: "John Smith", major: "International Business", email: "john@example.com" });
    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["passportNumber"] }),
    ]));
  });
  test("accepts International major when passportNumber is present", () => {
    expect(studentSchema.safeParse({ name: "John Smith", major: "International Business", email: "john@example.com", passportNumber: "AB123456" }).success).toBe(true);
  });
  test("rejects a name longer than 100 characters", () => {
    expect(studentSchema.safeParse({ name: "ก".repeat(101) }).success).toBe(false);
  });
});

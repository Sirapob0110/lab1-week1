const { z } = require("zod");

const createStudentSchema = z
  .object({
    name: z.string().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(100, "ชื่อต้องมีความยาวไม่เกิน 100 ตัวอักษร"),
    major: z.string().min(1, "กรุณาระบุ major").max(100, "major ต้องมีความยาวไม่เกิน 100 ตัวอักษร"),
    email: z.string().email("รูปแบบ email ไม่ถูกต้อง"),
    passportNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.major.startsWith("International") && !data.passportNumber) {
      ctx.addIssue({
        code: "custom",
        message: "ต้องระบุ passportNumber สำหรับสาขานานาชาติ",
        path: ["passportNumber"],
      });
    }
  });

module.exports = { createStudentSchema };

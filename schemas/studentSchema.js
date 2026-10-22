// Lightweight schema compatible with the safeParse() pattern used by Zod.
// Keeps this lab self-contained and avoids introducing another runtime dependency.
const studentSchema = {
  safeParse(input) {
    const value = input && typeof input === "object" ? input : {};
    const issues = [];

    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      issues.push({ path: ["name"], message: "กรุณาระบุชื่อ (name) เป็นข้อความที่ไม่ว่าง" });
    } else if (value.name.length > 100) {
      issues.push({ path: ["name"], message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร" });
    }

    if (value.major !== undefined && value.major !== null && typeof value.major !== "string") {
      issues.push({ path: ["major"], message: "major ต้องเป็นข้อความ" });
    }

    if (value.email !== undefined && value.email !== null && value.email !== "") {
      if (typeof value.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
        issues.push({ path: ["email"], message: "รูปแบบ email ไม่ถูกต้อง" });
      }
    }

    const major = typeof value.major === "string" ? value.major.trim() : "";
    if (/^international\b/i.test(major)) {
      if (typeof value.passportNumber !== "string" || value.passportNumber.trim().length === 0) {
        issues.push({ path: ["passportNumber"], message: "ต้องระบุ passportNumber สำหรับสาขานานาชาติ" });
      } else if (value.passportNumber.trim().length > 30) {
        issues.push({ path: ["passportNumber"], message: "passportNumber ต้องมีความยาวไม่เกิน 30 ตัวอักษร" });
      }
    } else if (value.passportNumber !== undefined && value.passportNumber !== null && typeof value.passportNumber !== "string") {
      issues.push({ path: ["passportNumber"], message: "passportNumber ต้องเป็นข้อความ" });
    }

    if (issues.length) return { success: false, error: { issues } };
    return { success: true, data: { ...value } };
  },
};

module.exports = { studentSchema };

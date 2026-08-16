// แบบฝึกหัดต่อยอดที่ 4: ทดสอบ Connection Pool ด้วยการยิง request พร้อมกัน 20 คำขอ
//
// สคริปต์นี้ยิงไปที่ endpoint จริงผ่าน HTTP (GET /api/v1/students) เพื่อจำลอง
// สถานการณ์ที่ client จำนวนมากเรียก API พร้อมกัน แล้วเทียบเวลาระหว่าง
// "ยิงพร้อมกันด้วย Promise.all()" กับ "ยิงทีละคำขอ (sequential)"
//
// วิธีรัน: ต้องเปิด server (npm run dev) ทิ้งไว้ก่อน แล้วรันไฟล์นี้แยกอีก terminal:
//   node test-pool.js

const BASE_URL = "http://localhost:3000/api/v1/students";
const TOTAL_REQUESTS = 20;

async function callApi(index) {
  const start = Date.now();
  const res = await fetch(BASE_URL);
  const durationMs = Date.now() - start;

  if (!res.ok) {
    throw new Error(`Request #${index} ล้มเหลว: HTTP ${res.status}`);
  }

  await res.json();
  return { index, durationMs };
}

async function runConcurrent() {
  console.log(
    `\n=== ยิงพร้อมกัน ${TOTAL_REQUESTS} requests ด้วย Promise.all() ===`,
  );
  const start = Date.now();

  const tasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) =>
    callApi(i + 1),
  );
  const results = await Promise.all(tasks);

  const totalMs = Date.now() - start;
  const durations = results.map((r) => r.durationMs);

  console.log(
    `สำเร็จทั้งหมด ${results.length} requests โดยไม่มี query ล้มเหลว`,
  );
  console.log(`เวลารวม: ${totalMs} ms`);
  console.log(
    `เวลาต่อ request: min ${Math.min(...durations)} ms / max ${Math.max(
      ...durations,
    )} ms / avg ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)} ms`,
  );
  return totalMs;
}

async function runSequential() {
  console.log(`\n=== ยิงทีละคำขอ (sequential) ${TOTAL_REQUESTS} requests ===`);
  const start = Date.now();

  const durations = [];
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    const result = await callApi(i);
    durations.push(result.durationMs);
  }

  const totalMs = Date.now() - start;
  console.log(`สำเร็จทั้งหมด ${TOTAL_REQUESTS} requests`);
  console.log(`เวลารวม: ${totalMs} ms`);
  console.log(
    `เวลาต่อ request: min ${Math.min(...durations)} ms / max ${Math.max(
      ...durations,
    )} ms / avg ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)} ms`,
  );
  return totalMs;
}

async function main() {
  console.log("เริ่มทดสอบ Connection Pool (connectionLimit: 10)");
  console.log(`Target: ${BASE_URL}`);

  try {
    const concurrentMs = await runConcurrent();
    const sequentialMs = await runSequential();

    console.log("\n=== สรุปเปรียบเทียบ ===");
    console.log(`Promise.all() (พร้อมกัน) : ${concurrentMs} ms`);
    console.log(`Sequential (ทีละคำขอ)     : ${sequentialMs} ms`);
    console.log(
      `เร็วขึ้น: ${(sequentialMs / concurrentMs).toFixed(2)} เท่า เมื่อยิงพร้อมกัน`,
    );
  } catch (err) {
    console.error("เกิดข้อผิดพลาดระหว่างทดสอบ:", err.message);
    process.exit(1);
  }
}

main();

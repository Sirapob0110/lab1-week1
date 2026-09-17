require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`,
  );
});
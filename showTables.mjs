import prisma from "./src/database/client.js";
const rows = await prisma.$queryRaw`SHOW TABLES`;
console.log(rows);
await prisma.$disconnect();

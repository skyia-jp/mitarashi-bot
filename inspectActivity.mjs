import prisma from "./src/database/client.js";
const records = await prisma.activityRecord.findMany({
  select: { id: true, guildId: true, userId: true, date: true },
  orderBy: { id: "desc" },
  take: 5
});
console.log(records);
await prisma.$disconnect();

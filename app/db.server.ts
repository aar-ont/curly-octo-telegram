import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Remix's dev server re-imports modules on change; without this the process
// accumulates connection pools until Postgres refuses new ones.
const prisma = global.prismaGlobal ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prismaGlobal = prisma;

export default prisma;

import prismaPkg from '@prisma/client';
import { pathConfig } from './pathConfig.js';

const { PrismaClient } = prismaPkg;

const dbUrl = process.env.DATABASE_URL || pathConfig.sqliteUrl;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

export default prisma;


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Attempting to connect to database...');
        const userCount = await prisma.user.count();
        console.log(`Connection successful. User count: ${userCount}`);
    } catch (error) {
        console.error('Database connection failed:');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

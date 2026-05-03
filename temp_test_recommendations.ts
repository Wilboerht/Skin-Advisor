import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  try {
    console.log('Testing getCandidateProducts...');
    const { getCandidateProducts } = await import('./src/lib/recommendations');
    const candidates = await getCandidateProducts({ skinType: 'combination', ageRange: '23-30' } as any, ['hydration'], 10);
    console.log('Candidates:', candidates.length, candidates.map((c: any) => c.name));
    
    console.log('\nTesting recommendProducts...');
    const { recommendProducts } = await import('./src/lib/recommendations');
    const recs = await recommendProducts({ skinType: 'combination', ageRange: '23-30' } as any, ['hydration'], candidates, 10);
    console.log('Recommendations:', recs.length, recs.map((r: any) => r.name));
  } catch (e: any) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
test();

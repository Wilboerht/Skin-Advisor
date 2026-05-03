import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  try {
    const count = await prisma.product.count();
    console.log('Total products:', count);
    
    const activeCount = await prisma.product.count({ where: { active: true } });
    console.log('Active products:', activeCount);
    
    const products = await prisma.product.findMany({ 
      where: { active: true },
      take: 5,
      select: { id: true, name: true, active: true, benefits: true }
    });
    console.log('First 5 active products:', JSON.stringify(products, null, 2));
    
    // Check advisorSession with analysisResult containing products
    const sessions = await prisma.advisorSession.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true, completedAt: true, createdAt: true, analysisResult: true }
    });
    console.log('\nRecent sessions:');
    for (const s of sessions) {
      const result = s.analysisResult as any;
      console.log(`Session ${s.sessionId}:`);
      console.log(`  createdAt: ${s.createdAt}`);
      console.log(`  completedAt: ${s.completedAt}`);
      console.log(`  has products: ${!!result?.products}`);
      console.log(`  products count: ${result?.products?.length || 0}`);
      if (result?.products?.length > 0) {
        console.log(`  products: ${JSON.stringify(result.products.map((p: any) => p.name))}`);
      }
    }
    
    // Check specific sessions
    for (const sid of ['moptwp44-epz7cj8oflf', 'mopnzqpx-hn5937gc3e', '3d79045d-f3fb-4dba-9695-7bdf97434eb0']) {
      const specificSession = await prisma.advisorSession.findUnique({
        where: { sessionId: sid },
        select: { sessionId: true, completedAt: true, analysisResult: true, answers: true, createdAt: true }
      });
      if (specificSession) {
        const result = specificSession.analysisResult;
        console.log(`\nSession ${sid}:`);
        console.log(`  completedAt: ${specificSession.completedAt}`);
        console.log(`  analysisResult type: ${result === null ? 'null' : typeof result}`);
        if (result && typeof result === 'object') {
          const r = result as any;
          console.log(`  analysisResult keys: ${Object.keys(r).join(', ')}`);
          console.log(`  has products field: ${'products' in r}`);
          console.log(`  products is array: ${Array.isArray(r.products)}`);
          console.log(`  products length: ${r.products?.length ?? 'undefined'}`);
          console.log(`  dataSource: ${r.dataSource || 'N/A'}`);
        }
      } else {
        console.log(`\nSession ${sid}: NOT FOUND`);
      }
    }
  } catch (e: any) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
check();

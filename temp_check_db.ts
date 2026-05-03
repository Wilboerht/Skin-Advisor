import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Connected:', result.rows[0].now);
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tables:', tables.rows.map((r: any) => r.table_name).join(', '));
    
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Product' 
      ORDER BY ordinal_position
    `);
    console.log('\nProduct columns:');
    for (const row of columns.rows) {
      console.log('  ' + row.column_name + ': ' + row.data_type);
    }
    
    const product = await pool.query(`SELECT id, name, active, created_at FROM "Product" WHERE active = true LIMIT 1`);
    console.log('\nActive product:', product.rows[0]);
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
check();

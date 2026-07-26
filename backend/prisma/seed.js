import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';

async function seed() {
  console.log('🌱 Starting On-Premise SQLite Database Seed...');

  const tenantId = '00000000-0000-0000-0000-000000000001';

  // 1. Ensure Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: { name: 'Lan 3JR' },
    create: {
      id: tenantId,
      name: 'Lan 3JR',
      cnpj: '00.000.000/0001-00'
    }
  });

  // 2. Ensure Super Admin User
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@kos.local' },
    update: { password_hash: adminPasswordHash },
    create: {
      tenant_id: tenant.id,
      email: 'admin@kos.local',
      password_hash: adminPasswordHash,
      full_name: 'Administrador Local',
      role: 'super_admin'
    }
  });

  // 3. Ensure Default Tenant Operator User
  const operatorPasswordHash = await bcrypt.hash('123456', 10);
  const operatorUser = await prisma.user.upsert({
    where: { email: 'atendimento@kos.local' },
    update: { password_hash: operatorPasswordHash },
    create: {
      tenant_id: tenant.id,
      email: 'atendimento@kos.local',
      password_hash: operatorPasswordHash,
      full_name: 'Rosana Talhas Gomes',
      role: 'tenant_admin'
    }
  });

  console.log('✅ Seed completed successfully!');
  console.log(`👤 Admin: ${adminUser.email} (Senha: admin123)`);
  console.log(`👤 Gerente: ${operatorUser.email} (Senha: 123456)`);
}

seed()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

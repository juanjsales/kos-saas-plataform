import { prisma } from '../config/db.js';

async function cleanTestData() {
  console.log('🧹 Clearing leftover test data from database...');

  try {
    // Delete test cards
    const deletedCards = await prisma.card.deleteMany({
      where: {
        OR: [
          { service: { title: { contains: 'Teste' } } },
          { service: { title: { contains: 'XSS' } } },
          { contact: { phone: '5511999998888' } },
          { contact: { name: { contains: 'Teste' } } }
        ]
      }
    });
    console.log(`✅ Deleted ${deletedCards.count} test cards.`);

    // Delete test services
    const deletedServices = await prisma.service.deleteMany({
      where: {
        OR: [
          { title: { contains: 'Teste' } },
          { title: { contains: 'XSS' } },
          { title: { contains: 'script' } }
        ]
      }
    });
    console.log(`✅ Deleted ${deletedServices.count} test services.`);

    // Delete test contacts
    const deletedContacts = await prisma.contact.deleteMany({
      where: {
        OR: [
          { phone: '5511999998888' },
          { name: { contains: 'Teste' } }
        ]
      }
    });
    console.log(`✅ Deleted ${deletedContacts.count} test contacts.`);
  } catch (err) {
    console.error('Error cleaning test data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanTestData();

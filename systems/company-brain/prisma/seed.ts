import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const job001 = await prisma.job.upsert({
    where: { id: 'job-001' },
    update: {},
    create: {
      id: 'job-001',
      type: 'promo',
      prompt: 'Promote the Made in the Hunnids drop. Start with Activities. Ensure the tone is aggressive but premium. Focus on the core community first.',
      status: 'PENDING',
      metadata: {
        catalog: 'Hunnids-2026',
        priority: 'high'
      }
    },
  })
  console.log({ job001 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

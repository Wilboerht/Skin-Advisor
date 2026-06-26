import prisma from "@/lib/prisma"

async function main() {
  const result = await prisma.campaign.deleteMany({})
  console.log(`Deleted ${result.count} campaign(s)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

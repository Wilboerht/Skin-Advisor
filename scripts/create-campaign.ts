import prisma from "@/lib/prisma"

async function main() {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 1)
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + 30)
  const drawDate = new Date(now)
  drawDate.setDate(drawDate.getDate() + 31)

  const campaign = await prisma.campaign.create({
    data: {
      title: "六月肌智派送好礼",
      subtitle: "分享肌肤形象，解锁 NIHPLOD 限定礼遇",
      description: "完成测肤获取专属肌肤形象，分享至小红书并 @NIHPLOD旎柏，即可参与活动抽奖。",
      status: "active",
      startDate,
      endDate,
      drawDate,
      prizes: [
        {
          name: "NIHPLOD 旎柏恒彩修护面霜",
          image: "/images/products/Face Cream.svg",
          quantity: 3,
          description: "修护屏障，焕亮肌肤",
        },
        {
          name: "NIHPLOD 旎柏聚光精华",
          image: "/images/products/Serum.svg",
          quantity: 5,
          description: "补水保湿，细腻透亮",
        },
        {
          name: "NIHPLOD 旎柏限定护肤礼包",
          image: "/images/gift.svg",
          quantity: 10,
          description: "旅行套装，随身呵护",
        },
      ],
      shareText: "快来参与 NIHPLOD 肌智派送好礼活动，测测你的肌肤形象类型，赢取限定礼遇！@NIHPLOD旎柏 #NIHPLOD #肌智派送好礼",
      rules: "1. 完成肌肤形象测试；2. 将结果海报分享至小红书并 @NIHPLOD旎柏；3. 在本页提交分享链接；4. 等待审核与开奖。",
      sortOrder: 1,
    },
  })

  console.log("Created campaign:", campaign.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

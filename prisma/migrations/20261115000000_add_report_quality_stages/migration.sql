-- ReportV3 Phase 6: 报告生成阶段耗时
ALTER TABLE "ReportQualityLog"
    ADD COLUMN "queueWaitMs" INTEGER,
    ADD COLUMN "textGenerationMs" INTEGER,
    ADD COLUMN "productSelectionMs" INTEGER,
    ADD COLUMN "safetyMs" INTEGER,
    ADD COLUMN "persistMs" INTEGER;

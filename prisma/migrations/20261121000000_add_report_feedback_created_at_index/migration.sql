-- Admin report-quality feedback board filters by global createdAt range.
-- The existing (userId, createdAt) composite index cannot serve that scan.
CREATE INDEX "ReportFeedback_createdAt_idx" ON "ReportFeedback"("createdAt");

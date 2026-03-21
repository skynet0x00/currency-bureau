-- Deactivate DZD and TND — removed from supported currencies in v1.0
UPDATE "Currency" SET "isActive" = false WHERE "code" IN ('DZD', 'TND');

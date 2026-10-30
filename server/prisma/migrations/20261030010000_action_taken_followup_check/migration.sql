-- Defense in depth for the Lab 4 business rule:
-- followUpRequired = true requires a non-blank followUpNote.
--
-- The API validates this too, but the database check protects future code
-- paths, scripts, and raw SQL from bypassing the controller layer.
ALTER TABLE "ActionTaken"
ADD CONSTRAINT "ActionTaken_followUpNote_required_check"
CHECK (
    NOT "followUpRequired"
    OR ("followUpNote" IS NOT NULL AND btrim("followUpNote") <> '')
);

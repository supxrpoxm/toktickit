-- Canonical database guard for the Lab 4 follow-up rule.
-- Keep the constraint name and expression stable so integration tests and
-- future migrations can target them directly.
ALTER TABLE "ActionTaken"
DROP CONSTRAINT IF EXISTS "ActionTaken_followUpNote_required_check";

ALTER TABLE "ActionTaken"
DROP CONSTRAINT IF EXISTS "check_followup_note_required";

ALTER TABLE "ActionTaken"
ADD CONSTRAINT "check_followup_note_required"
CHECK (
    ("followUpRequired" = false)
    OR (
        "followUpRequired" = true
        AND "followUpNote" IS NOT NULL
        AND length(trim("followUpNote")) > 0
    )
);

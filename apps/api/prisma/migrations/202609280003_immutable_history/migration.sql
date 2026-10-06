CREATE OR REPLACE FUNCTION protect_appointment_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'CONFIRMED' AND (
    (to_jsonb(NEW) - 'updatedAt' - 'rescheduledToId') <> (to_jsonb(OLD) - 'updatedAt' - 'rescheduledToId')
  ) THEN RAISE EXCEPTION 'Terminal appointments are read-only' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;

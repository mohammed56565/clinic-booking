CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "valid_working_window" CHECK (
  "dayOfWeek" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute"
);
ALTER TABLE "AppointmentType" ADD CONSTRAINT "positive_duration" CHECK ("durationMinutes" BETWEEN 1 AND 720);
ALTER TABLE "Appointment" ADD CONSTRAINT "valid_appointment_range" CHECK ("startAt" < "endAt");
ALTER TABLE "TemporaryHold" ADD CONSTRAINT "valid_hold_range" CHECK ("startAt" < "endAt");
ALTER TABLE "BlockedTime" ADD CONSTRAINT "valid_block_range" CHECK ("startAt" < "endAt");
CREATE UNIQUE INDEX "specialty_name_case_insensitive" ON "Specialty" (lower("name"));
CREATE UNIQUE INDEX "type_name_case_insensitive" ON "AppointmentType" (lower("name"));
CREATE UNIQUE INDEX "user_email_case_insensitive" ON "User" (lower("email"));

-- Half-open intervals allow adjacent appointments (10:00–10:30, 10:30–11:00).
ALTER TABLE "ScheduleOccupancy" ADD CONSTRAINT "doctor_no_overlap"
  EXCLUDE USING gist ("doctorId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&);
ALTER TABLE "ScheduleOccupancy" ADD CONSTRAINT "patient_no_overlap"
  EXCLUDE USING gist ("patientId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("patientId" IS NOT NULL);

-- Triggers protect all three source tables, including writes outside the API.
-- A single clinic-wide transaction lock establishes one ordering for source changes.
CREATE FUNCTION lock_clinic_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(73429101);
  DELETE FROM "ScheduleOccupancy" WHERE "expiresAt" <= clock_timestamp();
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION sync_clinic_occupancy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_id uuid; occupancy_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN row_id := OLD.id; ELSE row_id := NEW.id; END IF;
  occupancy_key := TG_TABLE_NAME || ':' || row_id::text;
  DELETE FROM "ScheduleOccupancy" WHERE key = occupancy_key;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'Appointment' THEN
    IF NEW.status = 'CONFIRMED' THEN
      INSERT INTO "ScheduleOccupancy" (key, "doctorId", "patientId", "startAt", "endAt")
        VALUES (occupancy_key, NEW."doctorId", NEW."patientId", NEW."startAt", NEW."endAt");
    END IF;
  ELSIF TG_TABLE_NAME = 'TemporaryHold' THEN
    IF NEW.status = 'ACTIVE' AND NEW."expiresAt" > clock_timestamp() THEN
      INSERT INTO "ScheduleOccupancy" (key, "doctorId", "patientId", "startAt", "endAt", "expiresAt")
        VALUES (occupancy_key, NEW."doctorId", NEW."patientId", NEW."startAt", NEW."endAt", NEW."expiresAt");
    END IF;
  ELSIF TG_TABLE_NAME = 'BlockedTime' THEN
    INSERT INTO "ScheduleOccupancy" (key, "doctorId", "startAt", "endAt")
      VALUES (occupancy_key, NEW."doctorId", NEW."startAt", NEW."endAt");
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER appointment_lock BEFORE INSERT OR UPDATE OR DELETE ON "Appointment" FOR EACH STATEMENT EXECUTE FUNCTION lock_clinic_schedule();
CREATE TRIGGER hold_lock BEFORE INSERT OR UPDATE OR DELETE ON "TemporaryHold" FOR EACH STATEMENT EXECUTE FUNCTION lock_clinic_schedule();
CREATE TRIGGER block_lock BEFORE INSERT OR UPDATE OR DELETE ON "BlockedTime" FOR EACH STATEMENT EXECUTE FUNCTION lock_clinic_schedule();
CREATE TRIGGER appointment_occupancy AFTER INSERT OR UPDATE OR DELETE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION sync_clinic_occupancy();
CREATE TRIGGER hold_occupancy AFTER INSERT OR UPDATE OR DELETE ON "TemporaryHold" FOR EACH ROW EXECUTE FUNCTION sync_clinic_occupancy();
CREATE TRIGGER block_occupancy AFTER INSERT OR UPDATE OR DELETE ON "BlockedTime" FOR EACH ROW EXECUTE FUNCTION sync_clinic_occupancy();

-- Terminal outcomes cannot be reopened or altered through ordinary SQL updates.
CREATE FUNCTION protect_appointment_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'CONFIRMED' AND (
    NEW.status <> OLD.status OR NEW."startAt" <> OLD."startAt" OR NEW."endAt" <> OLD."endAt" OR
    NEW."patientId" <> OLD."patientId" OR NEW."doctorId" <> OLD."doctorId" OR NEW."appointmentTypeId" <> OLD."appointmentTypeId"
  ) THEN RAISE EXCEPTION 'Terminal appointments are read-only' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_history BEFORE UPDATE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION protect_appointment_history();

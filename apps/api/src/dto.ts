import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
const Trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
export class LoginDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
  @IsString() @Length(8, 128) password!: string;
}
export class RegisterDto extends LoginDto {
  @Trim() @IsString() @Length(1, 100) name!: string;
}
export class ProfileDto {
  @Trim() @IsString() @Length(1, 100) name!: string;
}
export class SpecialtyDto {
  @Trim() @IsString() @Length(1, 100) name!: string;
}
export class TypeDto extends SpecialtyDto {
  @IsInt() @Min(1) @Max(720) durationMinutes!: number;
  @IsBoolean() isActive!: boolean;
}
export class DoctorDto extends RegisterDto {
  @IsUUID() specialtyId!: string;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID("all", { each: true })
  appointmentTypeIds!: string[];
}
export class DoctorEditDto extends ProfileDto {
  @IsUUID() specialtyId!: string;
  @IsBoolean() isActive!: boolean;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID("all", { each: true })
  appointmentTypeIds!: string[];
}
export class WindowDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsInt() @Min(0) @Max(1439) startMinute!: number;
  @IsInt() @Min(1) @Max(1440) endMinute!: number;
}
export class AvailabilityDto {
  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => WindowDto)
  windows!: WindowDto[];
}
export class BlockDto {
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;
  @IsISO8601({ strict: true }) @Matches(/(Z|[+-]\d{2}:\d{2})$/) endAt!: string;
  @IsOptional() @Trim() @IsString() @Length(0, 200) reason?: string;
}
export class HoldDto {
  @IsUUID() doctorId!: string;
  @IsUUID() appointmentTypeId!: string;
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;
  @IsOptional() @IsUUID() rescheduleOfId?: string;
}
export class ConfirmDto {
  @IsUUID() holdId!: string;
}
export class OutcomeDto {
  @IsIn(["COMPLETED", "NO_SHOW"]) status!: "COMPLETED" | "NO_SHOW";
}
export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}
export class SlotsQuery {
  @IsUUID() appointmentTypeId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}

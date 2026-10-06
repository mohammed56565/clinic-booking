import "reflect-metadata";
import "dotenv/config";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Module,
  ValidationPipe,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { INestApplication } from "@nestjs/common";
import { DateTime } from "luxon";
import helmet from "helmet";
import { AuthController, AuthGuard } from "./auth";
import { Db } from "./db";
import { ClinicController } from "./clinic";
import { AppointmentController, Appointments } from "./appointments";
import { Scheduling, timezone } from "./scheduling";
@Catch()
export class ApiErrors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    let status = 500,
      message: string | string[] =
        "Unable to complete this request. Please try again.";
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      message =
        typeof response === "string" ? response : (response as any).message;
    } else if (error.code === "P2002") {
      status = 409;
      message = "An account or record with these details already exists.";
    } else if (error.code === "P2025") {
      status = 404;
      message = "The requested record could not be found.";
    } else if (error.code === "P2003") {
      status = 400;
      message = "Select an existing specialty, doctor, or appointment type.";
    } else if (
      /23P01|exclusion constraint|doctor_no_overlap|patient_no_overlap/i.test(
        String(error.message),
      )
    ) {
      status = 409;
      message =
        "This appointment is no longer available. Please select another time.";
    } else if (/23514|check constraint/i.test(String(error.message))) {
      status = 400;
      message = "The supplied values violate a scheduling rule.";
    } else if (error.code === "P2034" || error.code === "P2028") {
      status = 409;
      message = "Scheduling changed during this request. Please try again.";
    }
    if (status === 500)
      console.error("Request failed:", error.code || error.name);
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({
        statusCode: status,
        message: Array.isArray(message) ? message.join(" ") : message,
      });
  }
}
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32 || secret.startsWith("replace-"))
          throw new Error("Set JWT_SECRET to at least 32 random characters.");
        return {
          secret,
          signOptions: {
            expiresIn: "8h",
            issuer: "clinic-api",
            audience: "clinic-web",
          },
          verifyOptions: { issuer: "clinic-api", audience: "clinic-web" },
        };
      },
    }),
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: process.env.NODE_ENV === "test" ? 10000 : 240 },
    ]),
  ],
  controllers: [AuthController, ClinicController, AppointmentController],
  providers: [
    Db,
    Scheduling,
    Appointments,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
export function configure(app: INestApplication) {
  if (!DateTime.now().setZone(timezone()).isValid)
    throw new Error("CLINIC_TIMEZONE must be a valid IANA timezone.");
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiErrors());
  app.enableShutdownHooks();
  return app;
}

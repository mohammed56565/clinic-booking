import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Post,
  Req,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import * as argon2 from "argon2";
import { Db } from "./db";
import { LoginDto, RegisterDto } from "./dto";
export const Public = () => SetMetadata("public", true);
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const safeUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  tokenVersion: true,
  doctor: { select: { id: true } },
  patient: { select: { id: true } },
} as const;
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  tokenVersion: number;
  doctor: { id: string } | null;
  patient: { id: string } | null;
};
export const publicUser = ({ tokenVersion, ...user }: Actor) => user;
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private db: Db,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride("public", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException("Please sign in to continue.");
    let payload: { sub: string; version: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        "Your session expired. Please sign in again.",
      );
    }
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: safeUser,
    });
    if (!user?.isActive || payload.version !== user.tokenVersion)
      throw new UnauthorizedException("Your session is no longer valid.");
    req.user = user;
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(user.role))
      throw new ForbiddenException(
        "You do not have permission to access this resource.",
      );
    return true;
  }
}
@Controller("auth")
export class AuthController {
  constructor(
    private db: Db,
    private jwt: JwtService,
  ) {}
  private async session(user: Actor) {
    return {
      token: await this.jwt.signAsync({
        sub: user.id,
        version: user.tokenVersion,
      }),
      user: publicUser(user),
    };
  }
  @Public()
  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Body() body: RegisterDto) {
    const passwordHash = await argon2.hash(body.password, {
      type: argon2.argon2id,
    });
    const user = await this.db.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: "PATIENT",
        patient: { create: {} },
      },
      select: safeUser,
    });
    return this.session(user);
  }
  @Public()
  @Post("login")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async login(@Body() body: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: body.email },
      include: { doctor: true, patient: true },
    });
    if (
      !user ||
      !(await argon2.verify(user.passwordHash, body.password)) ||
      !user.isActive
    )
      throw new UnauthorizedException("Invalid email or password.");
    return this.session({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      tokenVersion: user.tokenVersion,
      doctor: user.doctor ? { id: user.doctor.id } : null,
      patient: user.patient ? { id: user.patient.id } : null,
    });
  }
  @Get("me") me(@Req() req: { user: Actor }) {
    return publicUser(req.user);
  }
  @Post("logout") async logout(@Req() req: { user: Actor }) {
    await this.db.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    return { message: "Signed out." };
  }
}

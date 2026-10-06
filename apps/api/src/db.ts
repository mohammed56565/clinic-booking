import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;
@Injectable()
export class Db extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  // A transaction-scoped clinic lock also serializes schedule/type edits with booking.
  // READ COMMITTED gives each query a fresh snapshot after a waiting lock is acquired.
  async write<T>(action: (tx: Tx, now: Date) => Promise<T>): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(73429101)`;
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        await tx.temporaryHold.updateMany({
          where: { status: "ACTIVE", expiresAt: { lte: clock.now } },
          data: { status: "EXPIRED" },
        });
        return action(tx, clock.now);
      },
      { maxWait: 15000, timeout: 15000, isolationLevel: "ReadCommitted" },
    );
  }
}

import { NestFactory } from "@nestjs/core";
import { AppModule, configure } from "./app";
async function main() {
  const app = configure(await NestFactory.create(AppModule));
  await app.listen(
    Number(process.env.PORT || 3001),
    process.env.HOST || "127.0.0.1",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

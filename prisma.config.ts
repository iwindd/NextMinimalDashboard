import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
    // `prisma db seed` (and `prisma migrate reset`) run the default seed only.
    // Demonstration content is opt-in through `npm run db:seed:mockup`.
    seed: "tsx prisma/seed/default-seed.ts",
  },
});

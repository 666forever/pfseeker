import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  output: "server",
  site: "https://pfseeker.com",
  vite: {
    plugins: [tailwindcss()],
  },
});

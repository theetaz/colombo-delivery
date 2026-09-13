import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        artPreview: "art-preview.html",
        bicyclePreview: "bicycle-preview.html",
        characterPreview: "character-preview.html",
        characterCustomizer: "character-customizer.html",
      },
    },
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        artPreview: "art-preview.html",
        bicyclePreview: "bicycle-preview.html",
        bicycleModelReview: "bicycle-model-review.html",
        riderFitReview: "rider-fit-review.html",
        characterRigReview: "character-rig-review.html",
        characterPreview: "character-preview.html",
        characterCustomizer: "character-customizer.html",
      },
    },
  },
});

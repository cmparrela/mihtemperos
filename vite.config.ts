import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === "docs.google.com",
            handler: "NetworkOnly",
            method: "GET",
            options: {
              fetchOptions: {
                cache: "no-store",
              },
            },
          },
        ],
      },
      manifest: {
        name: "Pomar no Prédio",
        short_name: "Pomar no Prédio",
        description:
          "Encontre, compre e receba frutas fresquinhas do seu apartamento!",
        theme_color: "#10b981",
        icons: [
          {
            src: "192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});

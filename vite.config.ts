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
        name: "Mih Temperos",
        short_name: "Mih Temperos",
        description:
          "Encontre e peça temperos e ervas selecionados — retire no local ou receba em casa!",
        theme_color: "#5B3718",
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

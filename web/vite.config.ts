import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const portaApi = process.env.ESTUDOS_PORTA ?? "4317";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Acesso remoto (ex.: ngrok) só quando pedido: ESTUDOS_HOSTS_EXTRAS=".ngrok-free.app,.ngrok-free.dev"
    allowedHosts: (process.env.ESTUDOS_HOSTS_EXTRAS ?? "").split(",").filter((x) => x.startsWith(".")),
    proxy: { "/api": `http://127.0.0.1:${portaApi}` },
  },
});

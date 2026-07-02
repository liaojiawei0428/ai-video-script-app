// Replace with your server IP when deploying
// BUG-153 (v3.0.80): IP 159.75.16.110 → 119.91.155.46 (跟 BUG-147 server 端换 IP 同步, mobile 端 v3.0.74-79 漏修)
const DEV_SERVER_IP = '119.91.155.46';
const DEV_SERVER_PORT = '6000';
export const API_BASE_URL = `http://${DEV_SERVER_IP}:${DEV_SERVER_PORT}/api`;
export const WS_BASE_URL = `http://${DEV_SERVER_IP}:${DEV_SERVER_PORT}`;

#!/usr/bin/env node
/**
 * PM2 启动包装：加载 Next standalone server 后，等端口真正可连接再 send('ready')。
 * 配合 ecosystem.config.js 的 wait_ready=true，避免 PM2 在 HTTP 端口就绪前标记 online。
 */
require("../.next/standalone/server.js");

const net = require("net");

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOSTNAME && process.env.HOSTNAME !== "0.0.0.0"
    ? process.env.HOSTNAME
    : "127.0.0.1";

let attempts = 0;
const maxAttempts = 150; // 30s（每 200ms 一次）

const timer = setInterval(() => {
    const socket = net.connect({ port, host });
    socket.once("connect", () => {
        socket.destroy();
        clearInterval(timer);
        if (process.send) process.send("ready");
    });
    socket.once("error", () => {
        socket.destroy();
        attempts += 1;
        if (attempts >= maxAttempts) {
            clearInterval(timer);
            console.error(`[pm2-server] port ${host}:${port} not ready after ${maxAttempts * 200}ms`);
        }
    });
}, 200);

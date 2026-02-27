require('dotenv').config();
console.log("GTA VI CINEMATIC MODE");
console.log(`Boot commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || "local"}`);

const path = require('path');
const fs = require('fs');

const systemFontConfig = "/etc/fonts/fonts.conf";
if (!process.env.FONTCONFIG_FILE && fs.existsSync(systemFontConfig)) {
    process.env.FONTCONFIG_FILE = systemFontConfig;
}

if (process.env.FONTCONFIG_FILE && !fs.existsSync(process.env.FONTCONFIG_FILE)) {
    console.warn(`Ignoring invalid FONTCONFIG_FILE: ${process.env.FONTCONFIG_FILE}`);
    delete process.env.FONTCONFIG_FILE;
}
if (process.env.FONTCONFIG_PATH && !fs.existsSync(process.env.FONTCONFIG_PATH)) {
    console.warn(`Ignoring invalid FONTCONFIG_PATH: ${process.env.FONTCONFIG_PATH}`);
    delete process.env.FONTCONFIG_PATH;
}

const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const cron = require('node-cron');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || "1476993433594757192";
const RELEASE_DATE = new Date("2026-11-19T00:00:00");
const BACKGROUND_DIR = process.env.BACKGROUND_DIR || "backgrounds";

let messageId = null;
let cachedBackgrounds = null;

function registerLocalFonts() {
    const pricedownPath = path.join(__dirname, "pricedown.ttf");
    if (fs.existsSync(pricedownPath)) {
        registerFont(pricedownPath, { family: "Pricedown" });
    } else {
        console.warn("pricedown.ttf not found. Falling back to system fonts.");
    }
}

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function getBackgroundPaths() {
    if (cachedBackgrounds) {
        return cachedBackgrounds;
    }

    const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    const folderPath = path.join(__dirname, BACKGROUND_DIR);
    const backgrounds = [];

    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const fullPath = path.join(folderPath, file);
            const ext = path.extname(file).toLowerCase();
            if (allowedExt.has(ext) && fs.statSync(fullPath).isFile()) {
                backgrounds.push(fullPath);
            }
        }
    }

    if (backgrounds.length === 0) {
        backgrounds.push(path.join(__dirname, "bg.png"));
    }

    cachedBackgrounds = backgrounds.sort();
    return cachedBackgrounds;
}

function pickBackgroundPath(now) {
    const backgrounds = getBackgroundPaths();
    const minuteSeed = Math.floor(now.getTime() / 60000);
    const index = minuteSeed % backgrounds.length;
    return backgrounds[index];
}

async function postFreshCountdownMessage(channel) {
    const attachment = await generateImage();
    const message = await channel.send({ files: [attachment] });
    messageId = message.id;
}

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const channel = await client.channels.fetch(CHANNEL_ID);
    await postFreshCountdownMessage(channel);

    console.log("Countdown started...");

    cron.schedule('* * * * *', async () => {
        try {
            const newAttachment = await generateImage();
            const msg = await channel.messages.fetch(messageId);
            await msg.edit({ files: [newAttachment] });
            console.log("Updated.");
        } catch (error) {
            if (error && error.code === 10008) {
                console.warn("Countdown message was deleted. Posting a new one.");
                await postFreshCountdownMessage(channel);
                console.log("Posted replacement countdown message.");
            } else {
                console.error("Failed to update countdown message:", error);
            }
        }
    });
});

async function generateImage() {
    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');

    const now = new Date();
    const bg = await loadImage(pickBackgroundPath(now));
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    const remaining = RELEASE_DATE - now;
    const safeRemaining = Math.max(0, remaining);

    const days = Math.floor(safeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((safeRemaining / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((safeRemaining / (1000 * 60)) % 60);
    const values = [String(days).padStart(3, "0"), String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")];
    const labels = ["DAYS", "HOURS", "MINUTES"];

    const centerX = canvas.width / 2;
    const frameX = 90;
    const frameY = 136;
    const frameW = 1100;
    const frameH = 430;
    const tileGap = 22;
    const tileW = Math.floor((frameW - (tileGap * 4)) / 3);
    const tileH = 220;
    const tileY = frameY + 165;

    const dimmer = ctx.createLinearGradient(0, 0, 0, canvas.height);
    dimmer.addColorStop(0, "rgba(8, 10, 18, 0.28)");
    dimmer.addColorStop(1, "rgba(4, 5, 10, 0.58)");
    ctx.fillStyle = dimmer;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ambient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    ambient.addColorStop(0, "rgba(255, 99, 165, 0.14)");
    ambient.addColorStop(0.48, "rgba(255, 164, 92, 0.10)");
    ambient.addColorStop(1, "rgba(101, 221, 255, 0.11)");
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vignette = ctx.createRadialGradient(centerX, canvas.height / 2, 120, centerX, canvas.height / 2, 700);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.26)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    roundedRect(ctx, frameX, frameY, frameW, frameH, 34);
    const frameGradient = ctx.createLinearGradient(frameX, frameY, frameX, frameY + frameH);
    frameGradient.addColorStop(0, "rgba(18, 19, 32, 0.60)");
    frameGradient.addColorStop(1, "rgba(10, 11, 22, 0.68)");
    ctx.fillStyle = frameGradient;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 211, 155, 0.22)";
    ctx.stroke();

    roundedRect(ctx, frameX + 9, frameY + 9, frameW - 18, frameH - 18, 26);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.stroke();

    const titleGlow = ctx.createLinearGradient(frameX + 40, 0, frameX + 360, 0);
    titleGlow.addColorStop(0, "#ffd7a1");
    titleGlow.addColorStop(1, "#ff9c68");
    ctx.fillStyle = titleGlow;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = '800 50px "Pricedown"';
    ctx.fillText("GTA VI", frameX + 38, frameY + 70);

    ctx.fillStyle = "rgba(240, 226, 205, 0.90)";
    ctx.font = '600 24px "Pricedown"';
    ctx.fillText("OFFICIAL LAUNCH COUNTDOWN", frameX + 40, frameY + 102);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 215, 145, 0.96)";
    ctx.font = '700 30px "Pricedown"';
    ctx.fillText("19 NOV 2026", frameX + frameW - 38, frameY + 76);

    ctx.strokeStyle = "rgba(255, 198, 122, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(frameX + 36, frameY + 120);
    ctx.lineTo(frameX + frameW - 36, frameY + 120);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
        const tileX = frameX + tileGap + i * (tileW + tileGap);

        // Tile shadow for depth.
        roundedRect(ctx, tileX, tileY + 6, tileW, tileH, 20);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fill();

        roundedRect(ctx, tileX, tileY, tileW, tileH, 20);
        const tileGradient = ctx.createLinearGradient(tileX, tileY, tileX, tileY + tileH);
        tileGradient.addColorStop(0, "rgba(10, 15, 36, 0.74)");
        tileGradient.addColorStop(1, "rgba(5, 9, 26, 0.80)");
        ctx.fillStyle = tileGradient;
        ctx.fill();

        ctx.lineWidth = 1.1;
        ctx.strokeStyle = "rgba(123, 156, 222, 0.22)";
        ctx.stroke();

        const topShine = ctx.createLinearGradient(tileX, tileY, tileX, tileY + tileH * 0.56);
        topShine.addColorStop(0, "rgba(255, 255, 255, 0.08)");
        topShine.addColorStop(1, "rgba(255, 255, 255, 0)");
        roundedRect(ctx, tileX + 2, tileY + 2, tileW - 4, Math.floor(tileH * 0.50), 18);
        ctx.fillStyle = topShine;
        ctx.fill();

        const numGradient = ctx.createLinearGradient(tileX, tileY + 38, tileX, tileY + 140);
        numGradient.addColorStop(0, "#fff2de");
        numGradient.addColorStop(1, "#ffcf8d");
        ctx.fillStyle = numGradient;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
        ctx.shadowBlur = 8;
        ctx.font = '800 92px "Pricedown"';
        ctx.fillText(values[i], tileX + tileW / 2, tileY + 86);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#aec0ea";
        ctx.font = '700 29px "Pricedown"';
        ctx.fillText(labels[i], tileX + tileW / 2, tileY + 175);
    }

    const buffer = canvas.toBuffer("image/png");
    return new AttachmentBuilder(buffer, { name: "countdown.png" });
}

registerLocalFonts();
client.login(TOKEN);

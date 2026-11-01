/**
 * 提示音生成器（零依赖，纯 Node 运算，输出 16-bit 单声道 WAV）。
 *
 * 两段音效：
 * - attention.wav：上行纯五度双音铃（A5 → E6）——「等你操作 / 需要选择」；
 * - done.wav：下行纯五度双音铃（E6 → A5）——「任务结束 / 已停止」。
 *
 * 音色设计：基频 + 少量谐波做钟琴感，高位谐波衰减更快；8ms 软起音避免爆音，
 * 尾部 40ms 淡出；整体过一级 6kHz 低通削掉刺耳的高频毛刺。
 *
 * 运行：node tools/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 32000;
/** 钟琴音色分量：频率倍数、相对振幅、衰减时间常数（秒）。 */
const PARTIALS = [
	[1, 1.0, 0.42],
	[2, 0.34, 0.26],
	[3, 0.14, 0.16],
	[4.16, 0.07, 0.1],
	[0.5, 0.12, 0.5],
];

/** 半音等分律：音名 → 频率。 */
function note(name) {
	const table = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
	const match = /^([A-G])(#?)(\d)$/.exec(name);
	if (match === null) throw new Error(`无法解析音名：${name}`);
	const semitone = table[match[1]] + (match[2] === "#" ? 1 : 0);
	const octave = Number(match[3]);
	const midi = (octave + 1) * 12 + semitone;
	return 440 * 2 ** ((midi - 69) / 12);
}

/** 在缓冲区的指定时刻叠加一个钟音。 */
function addBell(samples, startSec, freq, durationSec, amplitude) {
	const start = Math.round(startSec * SAMPLE_RATE);
	const length = Math.round(durationSec * SAMPLE_RATE);
	for (let i = 0; i < length; i += 1) {
		const index = start + i;
		if (index >= samples.length) break;
		const t = i / SAMPLE_RATE;
		let value = 0;
		for (const [ratio, gain, tau] of PARTIALS) {
			value += gain * Math.exp(-t / tau) * Math.sin(2 * Math.PI * freq * ratio * t);
		}
		// 8ms 升余弦起音 + 40ms 尾部淡出，消除爆音。
		const attack = Math.min(1, t / 0.008);
		const release = Math.min(1, (durationSec - t) / 0.04);
		samples[index] += value * amplitude * (0.5 - 0.5 * Math.cos(Math.PI * attack)) * Math.max(0, release);
	}
}

/** 一级低通（RC），柔化高频。 */
function lowPass(samples, cutoffHz) {
	const dt = 1 / SAMPLE_RATE;
	const rc = 1 / (2 * Math.PI * cutoffHz);
	const alpha = dt / (rc + dt);
	let last = 0;
	for (let i = 0; i < samples.length; i += 1) {
		last += alpha * (samples[i] - last);
		samples[i] = last;
	}
}

/** 峰值归一 + tanh 软限幅。 */
function finalize(samples, peak) {
	let max = 0;
	for (const value of samples) max = Math.max(max, Math.abs(value));
	const scale = max === 0 ? 1 : peak / max;
	for (let i = 0; i < samples.length; i += 1) samples[i] = Math.tanh(samples[i] * scale * 1.05) / Math.tanh(1.05);
	return samples;
}

/** 编码为 16-bit PCM 单声道 WAV。 */
function encodeWav(samples) {
	const data = Buffer.alloc(samples.length * 2);
	for (let i = 0; i < samples.length; i += 1) {
		const clamped = Math.max(-1, Math.min(1, samples[i]));
		data.writeInt16LE(Math.round(clamped * 32767), i * 2);
	}
	const header = Buffer.alloc(44);
	header.write("RIFF", 0, "ascii");
	header.writeUInt32LE(36 + data.length, 4);
	header.write("WAVE", 8, "ascii");
	header.write("fmt ", 12, "ascii");
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20); // PCM
	header.writeUInt16LE(1, 22); // 单声道
	header.writeUInt32LE(SAMPLE_RATE, 24);
	header.writeUInt32LE(SAMPLE_RATE * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36, "ascii");
	header.writeUInt32LE(data.length, 40);
	return Buffer.concat([header, data]);
}

/** 由「若干 (时刻, 音名, 时长, 幅度)」序列合成一段提示音。 */
function render(sequence, totalSec) {
	const samples = new Float32Array(Math.round(totalSec * SAMPLE_RATE));
	for (const [at, name, duration, amplitude] of sequence) addBell(samples, at, note(name), duration, amplitude);
	lowPass(samples, 6200);
	return encodeWav(finalize(samples, 0.82));
}

const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(outputDir, { recursive: true });

const sounds = {
	// 上行纯五度：需要你操作（选择 / 确认 / 审批）。
	"attention.wav": render([[0, "A5", 0.95, 0.6], [0.11, "E6", 0.85, 0.5]], 1.15),
	// 下行纯五度：任务结束 / 已停止。
	"done.wav": render([[0, "E6", 0.8, 0.5], [0.12, "A5", 0.9, 0.58]], 1.15),
};

for (const [name, buffer] of Object.entries(sounds)) {
	const file = join(outputDir, name);
	writeFileSync(file, buffer);
	console.log(`${name}: ${buffer.length} bytes`);
}

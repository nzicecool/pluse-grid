import * as THREE from 'three';

export function createBoardPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep matte slate-carbon base
  ctx.fillStyle = '#121722';
  ctx.fillRect(0, 0, size, size);

  // Subtle diagonal carbon-weave micro-pattern
  ctx.fillStyle = '#182030';
  const step = 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      if (((x + y) / step) % 2 === 0) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  // Fine precision calibration grid lines
  ctx.strokeStyle = 'rgba(72, 118, 175, 0.14)';
  ctx.lineWidth = 1;
  const grid = 64;
  for (let i = 0; i <= size; i += grid) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Corner crosshair ticks
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.lineWidth = 2;
  for (let y = grid; y < size; y += grid) {
    for (let x = grid; x < size; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBrushedMetalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a3240';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    const shade = 36 + Math.floor(Math.sin(y * 0.7) * 6 + (Math.random() - 0.5) * 14);
    ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 16})`;
    ctx.fillRect(0, y, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFloorGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, size, size);

  // Subtle rubber athletic mat grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let i = 0; i < 1800; i++) {
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Court / lab grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  const sub = size / 4;
  for (let i = sub; i < size; i += sub) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPodGlyphTexture(label: string, accentHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  if (label) {
    // Crisp dark circular backing badge so numbers pop cleanly against emissive dome
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 74, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = accentHex;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 94px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size / 2 + 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class BoardHeaderDisplay {
  public readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private lastKey = '';

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 192;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
    this.update('PULSE GRID 3D', 'READY', 0, '#00f0ff');
  }

  public update(leftText: string, centerText: string, score: number, accentHex: string): void {
    const key = `${leftText}|${centerText}|${score}|${accentHex}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#06090f';
    ctx.fillRect(0, 0, w, h);

    // Subtle LED scanline grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }

    // Accent border strip
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Left badge (Wave / Mode)
    ctx.fillStyle = accentHex;
    ctx.font = '700 30px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(leftText, 36, h / 2 - 24);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText('NEURAL REFLEX SYSTEM', 36, h / 2 + 24);

    // Center Pattern indicator
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 38px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(centerText, w * 0.54, h / 2);

    // Right Score readout
    ctx.fillStyle = '#00f0ff';
    ctx.font = '800 54px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(score.toLocaleString(), w - 38, h / 2 + 2);

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
  }
}

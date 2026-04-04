import React, { useRef, useEffect, useCallback } from "react";
import { Video, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveMediaSrc } from "./resolveMediaSrc";

/**
 * MatteItem — WebGL Foreground + Matte compositing
 *
 * Two hidden videos feed GPU textures. A fragment shader reads the fgr
 * color and the matte red channel as alpha, outputting a premultiplied
 * RGBA result. One draw call per frame — entirely on GPU, zero CPU
 * pixel work.
 */

interface MatteItemData {
  fgrSrc: string;
  matteSrc: string;
  startFrom?: number;
}

interface MatteItemProps {
  data: MatteItemData;
  assets: Record<string, string>;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uFgr;
uniform sampler2D uMatte;
varying vec2 vUv;
void main() {
  vec4 fgr = texture2D(uFgr, vUv);
  float a = texture2D(uMatte, vUv).r;
  gl_FragColor = vec4(fgr.rgb * a, a);
}`;

interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  aPos: number;
  uFgr: WebGLUniformLocation;
  uMatte: WebGLUniformLocation;
  buf: WebGLBuffer;
  fgrTex: WebGLTexture;
  matteTex: WebGLTexture;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader: ${info}`);
  }
  return s;
}

function createTex(gl: WebGLRenderingContext): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

function initGL(canvas: HTMLCanvasElement): GLState | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Link: ${gl.getProgramInfoLog(program)}`);
  }

  const aPos = gl.getAttribLocation(program, "aPos");
  const uFgr = gl.getUniformLocation(program, "uFgr")!;
  const uMatte = gl.getUniformLocation(program, "uMatte")!;

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return { gl, program, aPos, uFgr, uMatte, buf, fgrTex: createTex(gl), matteTex: createTex(gl) };
}

export const MatteItem: React.FC<MatteItemProps> = React.memo(({ data, assets }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgrVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<GLState | null>(null);
  const lastTimeRef = useRef<number>(-1);

  const fgrSrc = resolveMediaSrc(data.fgrSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFromFrames = Math.round(((data.startFrom ?? 0) / 1000) * fps);

  // Init WebGL on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    glRef.current = initGL(canvas);
    if (!glRef.current) console.warn("WebGL unavailable for MatteItem");

    const onLost = (e: Event) => { e.preventDefault(); glRef.current = null; };
    const onRestored = () => { glRef.current = initGL(canvas); };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      glRef.current = null;
    };
  }, []);

  const draw = useCallback(() => {
    const fv = fgrVideoRef.current;
    const mv = matteVideoRef.current;
    if (!fv || !mv || fv.readyState < 2 || mv.readyState < 2) return;
    if (fv.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = fv.currentTime;

    const s = glRef.current;
    if (!s) {
      // Canvas2D fallback when WebGL is unavailable
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(fv, 0, 0, width, height);
      const fgrData = ctx.getImageData(0, 0, width, height);
      const fgrPx = fgrData.data;
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = width;
      tmpCanvas.height = height;
      const tmpCtx = tmpCanvas.getContext("2d", { willReadFrequently: true });
      if (!tmpCtx) return;
      tmpCtx.drawImage(mv, 0, 0, width, height);
      const mattePx = tmpCtx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < fgrPx.length; i += 4) {
        fgrPx[i + 3] = mattePx[i];
      }
      ctx.putImageData(fgrData, 0, 0);
      return;
    }
    const { gl, program, aPos, uFgr, uMatte, buf, fgrTex, matteTex } = s;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fgrTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fv);
    gl.uniform1i(uFgr, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, matteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mv);
    gl.uniform1i(uMatte, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [width, height]);

  useEffect(() => { draw(); }, [frame, draw]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Video
        ref={fgrVideoRef}
        src={fgrSrc}
        startFrom={startFromFrames}
        crossOrigin="anonymous"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering
        muted
        onLoadedData={draw}
      />
      <Video
        ref={matteVideoRef}
        src={matteSrc}
        startFrom={startFromFrames}
        crossOrigin="anonymous"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        pauseWhenBuffering
        muted
        onLoadedData={draw}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});

import React, { useRef, useEffect, useCallback } from "react";
import { Video, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveMediaSrc } from "./resolveMediaSrc";

/**
 * MatteItem — WebGL GPU-accelerated Foreground + Matte compositing
 *
 * A fragment shader reads fgr RGB and matte red channel, outputs:
 *   gl_FragColor = vec4(fgr.rgb, matte.r)
 *
 * Zero getImageData / putImageData — entirely GPU, no main thread blocking.
 * Requires crossOrigin="anonymous" on video elements (MinIO serves CORS headers).
 */

const VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_fgr;
  uniform sampler2D u_matte;
  void main() {
    vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
    vec4 fgr = texture2D(u_fgr, uv);
    float alpha = texture2D(u_matte, uv).r;
    gl_FragColor = vec4(fgr.rgb * alpha, alpha);
  }
`;

interface GLResources {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  fgrTex: WebGLTexture;
  matteTex: WebGLTexture;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

function initGL(canvas: HTMLCanvasElement): GLResources | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Full-screen quad
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  // Textures
  function makeTex(unit: number): WebGLTexture {
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }
  const fgrTex = makeTex(0);
  const matteTex = makeTex(1);

  gl.uniform1i(gl.getUniformLocation(prog, "u_fgr"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "u_matte"), 1);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  return { gl, program: prog, fgrTex, matteTex };
}

interface MatteItemData {
  fgrSrc: string;
  matteSrc: string;
  startFrom?: number;
}

interface MatteItemProps {
  data: MatteItemData;
  assets: Record<string, string>;
}

export const MatteItem: React.FC<MatteItemProps> = React.memo(({ data, assets }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fgrVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<GLResources | null>(null);
  const lastTimeRef = useRef<number>(-1);

  const fgrSrc = resolveMediaSrc(data.fgrSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFromFrames = Math.round(((data.startFrom ?? 0) / 1000) * fps);

  // Init WebGL on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    glRef.current = initGL(canvas);
  }, []);

  const doRender = useCallback(() => {
    const fv = fgrVideoRef.current;
    const mv = matteVideoRef.current;
    const res = glRef.current;
    if (!fv || !mv || !res) return;
    if (fv.readyState < 2 || mv.readyState < 2) return;
    if (fv.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = fv.currentTime;

    const { gl, fgrTex, matteTex } = res;
    const cw = fv.videoWidth || width;
    const ch = fv.videoHeight || height;

    if (gl.canvas.width !== cw || gl.canvas.height !== ch) {
      (gl.canvas as HTMLCanvasElement).width = cw;
      (gl.canvas as HTMLCanvasElement).height = ch;
      gl.viewport(0, 0, cw, ch);
    }

    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fgrTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fv);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, matteTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mv);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } catch {
      // SecurityError fallback — shouldn't happen with CORS but safe guard
    }
  }, [width, height]);

  useEffect(() => { doRender(); }, [frame, doRender]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Video
        ref={fgrVideoRef}
        src={fgrSrc}
        crossOrigin="anonymous"
        startFrom={startFromFrames}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        muted
        onLoadedData={doRender}
      />
      <Video
        ref={matteVideoRef}
        src={matteSrc}
        crossOrigin="anonymous"
        startFrom={startFromFrames}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        muted
        onLoadedData={doRender}
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

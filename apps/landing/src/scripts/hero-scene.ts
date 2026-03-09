import * as THREE from "three";

const VIOLET_PRIMARY = 0x7c3aed;
const VIOLET_SECONDARY = 0xa78bfa;
const VIOLET_ACCENT = 0xc084fc;

interface FloatingShape {
  mesh: THREE.Mesh;
  // Target rotation velocities (what we lerp towards)
  targetRotSpeed: THREE.Vector3;
  // Current rotation velocities (smoothed)
  currentRotSpeed: THREE.Vector3;
  floatSpeed: number;
  floatOffset: number;
  baseY: number;
  baseX: number;
  // Subtle scale breathing
  scaleBase: number;
  scaleSpeed: number;
  scaleOffset: number;
}

export function initHeroScene(canvas: HTMLCanvasElement) {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 12);

  // Soft lighting
  const ambientLight = new THREE.AmbientLight(0xfafaff, 0.6);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1);
  mainLight.position.set(5, 5, 5);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(VIOLET_ACCENT, 0.4);
  fillLight.position.set(-3, -2, 4);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(VIOLET_SECONDARY, 0.8, 20);
  rimLight.position.set(-5, 3, 2);
  scene.add(rimLight);

  // Materials
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: VIOLET_PRIMARY,
    metalness: 0.1,
    roughness: 0.15,
    transparent: true,
    opacity: 0.55,
    transmission: 0.6,
    thickness: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });

  const solidMaterial = new THREE.MeshPhysicalMaterial({
    color: VIOLET_SECONDARY,
    metalness: 0.3,
    roughness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  });

  const accentMaterial = new THREE.MeshPhysicalMaterial({
    color: VIOLET_ACCENT,
    metalness: 0.05,
    roughness: 0.3,
    transparent: true,
    opacity: 0.7,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });

  // Higher subdivision for smoother geometry
  const geometries = [
    new THREE.IcosahedronGeometry(0.7, 1),
    new THREE.TorusGeometry(0.5, 0.2, 24, 48),
    new THREE.OctahedronGeometry(0.6, 1),
    new THREE.SphereGeometry(0.45, 48, 48),
    new THREE.TorusKnotGeometry(0.35, 0.12, 100, 24, 2, 3),
    new THREE.DodecahedronGeometry(0.5, 1),
  ];

  const materials = [
    glassMaterial,
    solidMaterial,
    accentMaterial,
    glassMaterial,
    solidMaterial,
    accentMaterial,
  ];

  // Shape positions — spread around the edges, away from center text
  const positions = [
    { x: -5.2, y: 2.0, z: -2 },
    { x: 5.5, y: 1.5, z: -1.5 },
    { x: -4.0, y: -2.2, z: -1 },
    { x: 4.8, y: -1.8, z: -2.5 },
    { x: -2.5, y: 3.2, z: -3 },
    { x: 3.0, y: -3.0, z: -2 },
  ];

  const shapes: FloatingShape[] = geometries.map((geo, i) => {
    const mesh = new THREE.Mesh(geo, materials[i]);
    const pos = positions[i];
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    scene.add(mesh);

    const rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.002
    );

    return {
      mesh,
      targetRotSpeed: rotSpeed.clone(),
      currentRotSpeed: new THREE.Vector3(0, 0, 0),
      floatSpeed: 0.15 + Math.random() * 0.2,
      floatOffset: Math.random() * Math.PI * 2,
      baseY: pos.y,
      baseX: pos.x,
      scaleBase: 1,
      scaleSpeed: 0.2 + Math.random() * 0.15,
      scaleOffset: Math.random() * Math.PI * 2,
    };
  });

  // Smoothed mouse state
  const mouse = { x: 0, y: 0 };
  const smoothMouse = { x: 0, y: 0 };
  const cameraTarget = { x: 0, y: 0 };

  function onMouseMove(e: MouseEvent) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  window.addEventListener("mousemove", onMouseMove, { passive: true });

  // Resize
  function onResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", onResize, { passive: true });

  // Lerp helper
  function lerp(current: number, target: number, factor: number): number {
    return current + (target - current) * factor;
  }

  // Animation loop
  let animationId: number;
  const clock = new THREE.Clock();

  function animate() {
    animationId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const delta = Math.min(clock.getDelta(), 0.05); // cap delta to avoid jumps
    const speed = prefersReducedMotion ? 0.1 : 1;

    // Double-smoothed mouse: raw → smoothMouse → cameraTarget
    const mouseLerp = 1 - Math.pow(0.05, delta);
    smoothMouse.x = lerp(smoothMouse.x, mouse.x, mouseLerp);
    smoothMouse.y = lerp(smoothMouse.y, mouse.y, mouseLerp);

    const cameraLerp = 1 - Math.pow(0.03, delta);
    cameraTarget.x = smoothMouse.y * 0.08;
    cameraTarget.y = smoothMouse.x * 0.1;
    camera.rotation.x = lerp(camera.rotation.x, cameraTarget.x, cameraLerp);
    camera.rotation.y = lerp(camera.rotation.y, cameraTarget.y, cameraLerp);

    // Animate shapes
    const rotLerp = 1 - Math.pow(0.02, delta);

    for (const shape of shapes) {
      // Smoothly ramp up rotation speed (no instant snapping)
      shape.currentRotSpeed.x = lerp(shape.currentRotSpeed.x, shape.targetRotSpeed.x, rotLerp);
      shape.currentRotSpeed.y = lerp(shape.currentRotSpeed.y, shape.targetRotSpeed.y, rotLerp);
      shape.currentRotSpeed.z = lerp(shape.currentRotSpeed.z, shape.targetRotSpeed.z, rotLerp);

      shape.mesh.rotation.x += shape.currentRotSpeed.x * speed;
      shape.mesh.rotation.y += shape.currentRotSpeed.y * speed;
      shape.mesh.rotation.z += shape.currentRotSpeed.z * speed;

      // Smooth float — dual sine for organic motion
      const t = elapsed * speed;
      shape.mesh.position.y =
        shape.baseY +
        Math.sin(t * shape.floatSpeed + shape.floatOffset) * 0.3 +
        Math.sin(t * shape.floatSpeed * 0.7 + shape.floatOffset + 1.5) * 0.15;

      // Subtle horizontal drift
      shape.mesh.position.x =
        shape.baseX +
        Math.sin(t * shape.floatSpeed * 0.5 + shape.floatOffset + 0.8) * 0.12;

      // Gentle scale breathing
      const scalePulse =
        1 +
        Math.sin(t * shape.scaleSpeed + shape.scaleOffset) * 0.04 +
        Math.sin(t * shape.scaleSpeed * 1.3 + shape.scaleOffset) * 0.02;
      shape.mesh.scale.setScalar(scalePulse);

      // Shapes subtly react to mouse — drift towards cursor
      shape.mesh.position.x += smoothMouse.x * 0.15;
      shape.mesh.position.y += smoothMouse.y * 0.1;
    }

    renderer.render(scene, camera);
  }

  animate();

  // Cleanup
  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
    for (const shape of shapes) {
      shape.mesh.geometry.dispose();
      (shape.mesh.material as THREE.Material).dispose();
    }
  };
}

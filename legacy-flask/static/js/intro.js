const canvas = document.getElementById('rain-canvas');

(async () => {
  let THREE, GLTFLoader;
  try {
    THREE = await import('three');
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (e) {
    console.warn('Three.js failed to load — skipping ambient rain.', e);
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
  const CAM_Z  = 12;
  camera.position.set(0, 0, CAM_Z);

  scene.add(new THREE.AmbientLight(0x6b7280, 1.2));
  const key = new THREE.DirectionalLight(0xe8edf5, 2.4);
  key.position.set(-4, 8, 6); scene.add(key);
  const rim = new THREE.PointLight(0xbcd0f0, 2.6, 60);
  rim.position.set(6, -2, 8); scene.add(rim);

  function bounds() {
    const h = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * CAM_Z;
    return { w: h * camera.aspect, h };
  }

  const rainMat = new THREE.MeshStandardMaterial({
    color: 0xc3c8d0, metalness: 0.55, roughness: 0.2,
    emissive: 0x3a4150, emissiveIntensity: 0.35,
    transparent: true, opacity: 0.16,
  });

  const loader = new GLTFLoader();
  let template;
  try {
    const gltf = await loader.loadAsync('/static/models/rain.glb');
    const src  = gltf.scene;
    src.traverse(o => { if (o.isMesh) o.material = rainMat; });
    const box = new THREE.Box3().setFromObject(src);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    src.position.sub(center);
    const wrap = new THREE.Group(); wrap.add(src);
    wrap.scale.setScalar(1 / maxDim);
    template = new THREE.Group(); template.add(wrap);
  } catch (e) {
    console.warn('rain.glb failed to load — skipping ambient rain.', e);
    renderer.dispose();
    return;
  }

  const DROPS = innerWidth < 700 ? 26 : 45;
  const drops = [];
  function resetDrop(d, top) {
    const bb = bounds();
    d.obj.position.x = (Math.random() - 0.5) * bb.w * 1.05;
    d.obj.position.z = (Math.random() - 0.5) * 7 - 1;
    d.obj.position.y = top ? bb.h / 2 + Math.random() * bb.h : (Math.random() - 0.5) * bb.h;
    d.s = 0.1 + Math.random() * Math.random() * 0.85;
    d.obj.scale.setScalar(d.s);
    d.v = (6 + Math.random() * 9 + d.s * 4);
    d.spin = (Math.random() - 0.5) * 1.0;
    d.obj.rotation.y = Math.random() * Math.PI * 2;
  }
  for (let i = 0; i < DROPS; i++) {
    const obj = template.clone(true);
    const d = { obj };
    resetDrop(d, false);
    scene.add(obj);
    drops.push(d);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }, { passive: true });

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const bb = bounds();
    for (const d of drops) {
      d.obj.position.y -= d.v * dt;
      d.obj.rotation.y += d.spin * dt;
      if (d.obj.position.y < -bb.h / 2 - 1) resetDrop(d, true);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

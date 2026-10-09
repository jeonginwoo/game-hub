// 로비 진입점 — 빈 Three.js 씬. 렌더러·리사이즈·렌더 루프만 둔다.
// 카메라 방식(직교 + 스프라이트 vs 3D)은 열린 질문 4 가 정해지면 바꾼다 — 지금은 임시 원근 카메라.
import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#app');
if (!canvas) throw new Error('#app 캔버스가 없다');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1f2a);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

// 렌더 루프가 도는지 눈으로 확인하기 위한 격자 — 타일맵이 들어오면 제거
scene.add(new THREE.GridHelper(20, 20, 0x5a6b8c, 0x2e3545));

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => renderer.render(scene, camera));

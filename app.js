import * as THREE from 'three'

const canvas = document.getElementById('scene')
const sceneWrap = document.getElementById('sceneWrap')
const rollBtn = document.getElementById('rollBtn')
const resetBtn = document.getElementById('resetBtn')
const tapRoll = document.getElementById('tapRoll')
const resultValue = document.getElementById('resultValue')
const statusText = document.getElementById('statusText')

let renderer
let scene
let camera
let diceGroup
let animationFrame = null
let isRolling = false
let currentFace = 1
let rollState = null

const FACE_ROTATIONS = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -Math.PI / 2 },
  3: { x: Math.PI / 2, y: 0 },
  4: { x: -Math.PI / 2, y: 0 },
  5: { x: 0, y: Math.PI / 2 },
  6: { x: Math.PI, y: 0 }
}

function createRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(sceneWrap.clientWidth, sceneWrap.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

function createScene() {
  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x07111f, 14, 28)

  camera = new THREE.PerspectiveCamera(42, sceneWrap.clientWidth / sceneWrap.clientHeight, 0.1, 100)
  camera.position.set(0, 2.6, 6.8)
  camera.lookAt(0, 0.5, 0)

  const ambient = new THREE.AmbientLight(0xffffff, 1.2)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
  keyLight.position.set(4, 8, 6)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.width = 1024
  keyLight.shadow.mapSize.height = 1024
  scene.add(keyLight)

  const rimLight = new THREE.PointLight(0x45d6ff, 18, 30, 2)
  rimLight.position.set(-5, 3, -4)
  scene.add(rimLight)

  const fillLight = new THREE.PointLight(0x7c5cff, 14, 24, 2)
  fillLight.position.set(4, -1, 5)
  scene.add(fillLight)

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 4.4, 0.45, 64),
    new THREE.MeshStandardMaterial({
      color: 0x122033,
      metalness: 0.2,
      roughness: 0.75,
      emissive: 0x08111d,
      emissiveIntensity: 0.7
    })
  )
  floor.position.y = -1.55
  floor.receiveShadow = true
  scene.add(floor)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.08, 24, 100),
    new THREE.MeshStandardMaterial({
      color: 0x45d6ff,
      emissive: 0x45d6ff,
      emissiveIntensity: 0.9,
      metalness: 0.4,
      roughness: 0.25
    })
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = -1.28
  scene.add(ring)

  const backGlow = new THREE.Mesh(
    new THREE.SphereGeometry(8, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x0c1f36, transparent: true, opacity: 0.45 })
  )
  backGlow.position.z = -8
  scene.add(backGlow)
}

function createPipTexture(face) {
  const size = 512
  const pipLayouts = {
    1: [[0, 0]],
    2: [[-0.95, -0.95], [0.95, 0.95]],
    3: [[-1.05, -1.05], [0, 0], [1.05, 1.05]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1.15], [1, -1.15], [-1, 0], [1, 0], [-1, 1.15], [1, 1.15]]
  }

  const canvasTexture = document.createElement('canvas')
  canvasTexture.width = size
  canvasTexture.height = size
  const ctx = canvasTexture.getContext('2d')

  ctx.fillStyle = '#fffaf2'
  ctx.fillRect(0, 0, size, size)

  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(124,92,255,0.08)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 16
  ctx.strokeRect(8, 8, size - 16, size - 16)

  ctx.fillStyle = '#101820'
  const radius = 38
  for (const [x, y] of pipLayouts[face]) {
    ctx.beginPath()
    ctx.arc(size / 2 + x * 110, size / 2 + y * 110, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvasTexture)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createDice() {
  const geometry = new THREE.BoxGeometry(2.1, 2.1, 2.1)
  const materials = [1, 2, 3, 4, 5, 6].map((face) => new THREE.MeshStandardMaterial({
    map: createPipTexture(face),
    roughness: 0.34,
    metalness: 0.08
  }))

  const cube = new THREE.Mesh(geometry, materials)
  cube.castShadow = true
  cube.receiveShadow = true

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.12, 2.12, 2.12)),
    new THREE.LineBasicMaterial({ color: 0xd6dcff, transparent: true, opacity: 0.55 })
  )

  diceGroup = new THREE.Group()
  diceGroup.add(cube)
  diceGroup.add(edges)
  diceGroup.position.y = 0.35
  scene.add(diceGroup)

  setDiceFace(1, true)
}

function setDiceFace(face, immediate = false) {
  currentFace = face
  const rotation = FACE_ROTATIONS[face]
  if (immediate) {
    diceGroup.rotation.x = rotation.x
    diceGroup.rotation.y = rotation.y
    diceGroup.rotation.z = 0
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function startRoll() {
  if (isRolling || !diceGroup) return
  isRolling = true
  const nextFace = Math.floor(Math.random() * 6) + 1
  const target = FACE_ROTATIONS[nextFace]
  const extraSpinsX = (Math.floor(Math.random() * 3) + 4) * Math.PI * 2
  const extraSpinsY = (Math.floor(Math.random() * 3) + 5) * Math.PI * 2
  const extraSpinsZ = (Math.floor(Math.random() * 2) + 3) * Math.PI * 2

  rollState = {
    start: performance.now(),
    duration: 1450,
    fromRotation: {
      x: diceGroup.rotation.x,
      y: diceGroup.rotation.y,
      z: diceGroup.rotation.z
    },
    toRotation: {
      x: target.x + extraSpinsX,
      y: target.y + extraSpinsY,
      z: extraSpinsZ
    },
    fromY: 0.35,
    toY: 0.35,
    result: nextFace
  }

  statusText.textContent = 'Rolling...'
  resultValue.textContent = '…'
}

function resetView() {
  if (!diceGroup) return
  isRolling = false
  rollState = null
  setDiceFace(1, true)
  diceGroup.position.y = 0.35
  resultValue.textContent = '—'
  statusText.textContent = 'Ready to roll'
}

function animate(now) {
  animationFrame = requestAnimationFrame(animate)

  if (diceGroup) {
    if (rollState) {
      const elapsed = now - rollState.start
      const t = Math.min(elapsed / rollState.duration, 1)
      const eased = easeOutCubic(t)

      diceGroup.rotation.x = rollState.fromRotation.x + (rollState.toRotation.x - rollState.fromRotation.x) * eased
      diceGroup.rotation.y = rollState.fromRotation.y + (rollState.toRotation.y - rollState.fromRotation.y) * eased
      diceGroup.rotation.z = rollState.fromRotation.z + (rollState.toRotation.z - rollState.fromRotation.z) * eased
      diceGroup.position.y = rollState.fromY + Math.sin(t * Math.PI) * 0.7

      if (t >= 1) {
        const result = rollState.result
        rollState = null
        isRolling = false
        setDiceFace(result, true)
        diceGroup.position.y = 0.35
        resultValue.textContent = String(result)
        statusText.textContent = `Landed on ${result}`
      }
    } else {
      diceGroup.rotation.y += 0.004
      diceGroup.rotation.x += 0.0015
    }
  }

  renderer.render(scene, camera)
}

function resize() {
  if (!renderer || !camera) return
  const width = sceneWrap.clientWidth
  const height = sceneWrap.clientHeight
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function bindEvents() {
  rollBtn.addEventListener('click', () => {
    try {
      startRoll()
    } catch (error) {
      console.error('Roll button error:', error.message)
    }
  })

  tapRoll.addEventListener('click', () => {
    try {
      startRoll()
    } catch (error) {
      console.error('Tap roll error:', error.message)
    }
  })

  canvas.addEventListener('click', () => {
    try {
      startRoll()
    } catch (error) {
      console.error('Canvas roll error:', error.message)
    }
  })

  resetBtn.addEventListener('click', () => {
    try {
      resetView()
    } catch (error) {
      console.error('Reset error:', error.message)
    }
  })

  window.addEventListener('resize', () => {
    try {
      resize()
    } catch (error) {
      console.error('Resize error:', error.message)
    }
  })
}

function init() {
  try {
    createRenderer()
    createScene()
    createDice()
    bindEvents()
    resize()
    animate(performance.now())
  } catch (error) {
    console.error('Init error:', error.message, error.stack)
    statusText.textContent = 'Could not load 3D scene'
  }
}

init()

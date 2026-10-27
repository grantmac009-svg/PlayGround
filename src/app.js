'use strict'

;(function () {
  const stage = document.getElementById('stage')
  const ctx = stage.getContext('2d')
  const layerList = document.getElementById('layer-list')
  const propsBox = document.getElementById('props')
  const statusEl = document.getElementById('status')
  const countEl = document.getElementById('layer-count')
  const fileInput = document.getElementById('file-input')

  const WIDTH = stage.width
  const HEIGHT = stage.height
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const PALETTE = ['#f59e0b', '#22d3ee', '#f472b6', '#a78bfa', '#34d399', '#fb7185', '#facc15', '#38bdf8']

  const state = {
    layers: [],
    selectedId: null,
    running: false,
    nextId: 1,
    shapeIndex: 0
  }

  const sparks = Array.from({ length: 34 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    r: 2 + Math.random() * 5,
    speed: 0.25 + Math.random() * 0.85,
    phase: Math.random() * Math.PI * 2,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)]
  }))

  function setStatus (message) {
    statusEl.textContent = message
  }

  function selectedLayer () {
    return state.layers.find(layer => layer.id === state.selectedId) || null
  }

  function measureText (layer) {
    ctx.save()
    ctx.font = `700 ${layer.fontSize}px ${FONT}`
    const width = Math.max(24, ctx.measureText(layer.text || ' ').width)
    ctx.restore()
    layer.w = Math.round(width + 8)
    layer.h = Math.round(layer.fontSize * 1.3)
  }

  function seedScene () {
    const title = {
      id: state.nextId++, type: 'text', name: 'Title', text: 'PlayGround Studio',
      x: 54, y: 56, w: 520, h: 78, rot: 0, opacity: 1, fill: '#f8fafc', fontSize: 60
    }
    measureText(title)

    const subtitle = {
      id: state.nextId++, type: 'text', name: 'Subtitle',
      text: 'Arrange images, text and shapes — drag anything on the canvas.',
      x: 56, y: 150, w: 620, h: 34, rot: 0, opacity: 0.92, fill: '#dbeafe', fontSize: 24
    }
    measureText(subtitle)

    const badge = {
      id: state.nextId++, type: 'text', name: 'Badge', text: 'Layer 1 of 3',
      x: 96, y: 292, w: 200, h: 30, rot: -5, opacity: 1, fill: '#0f172a', fontSize: 22
    }
    measureText(badge)

    state.layers = [
      title,
      subtitle,
      { id: state.nextId++, type: 'rect', name: 'Amber card', x: 64, y: 236, w: 286, h: 168, rot: -5, opacity: 1, fill: '#f59e0b' },
      badge,
      { id: state.nextId++, type: 'ellipse', name: 'Teal orb', x: 404, y: 248, w: 196, h: 196, rot: 0, opacity: 1, fill: '#22d3ee' },
      { id: state.nextId++, type: 'rect', name: 'Rose card', x: 654, y: 252, w: 232, h: 156, rot: 8, opacity: 1, fill: '#f472b6' },
      { id: state.nextId++, type: 'text', name: 'Caption', text: 'Play, remix, export',
        x: 666, y: 442, w: 260, h: 36, rot: 0, opacity: 0.9, fill: '#e2e8f0', fontSize: 26 }
    ]
    const caption = state.layers[state.layers.length - 1]
    measureText(caption)
    state.selectedId = title.id
  }

  function drawBackground () {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
    gradient.addColorStop(0, '#1e3a8a')
    gradient.addColorStop(0.45, '#312e81')
    gradient.addColorStop(1, '#0f766e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    for (let x = 0; x <= WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke()
    }
    for (let y = 0; y <= HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke()
    }
    ctx.restore()

    const glow = ctx.createRadialGradient(WIDTH * 0.78, HEIGHT * 0.2, 10, WIDTH * 0.78, HEIGHT * 0.2, 340)
    glow.addColorStop(0, 'rgba(255,255,255,0.20)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  function drawLayer (layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2)
    ctx.rotate((layer.rot * Math.PI) / 180)

    if (layer.type === 'rect') {
      ctx.fillStyle = layer.fill
      ctx.shadowColor = 'rgba(2,6,23,0.35)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 8
      const w = layer.w
      const h = layer.h
      const r = Math.min(18, w / 4, h / 4)
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(-w / 2, -h / 2, w, h, r)
      else ctx.rect(-w / 2, -h / 2, w, h)
      ctx.fill()
    } else if (layer.type === 'ellipse') {
      ctx.fillStyle = layer.fill
      ctx.shadowColor = 'rgba(2,6,23,0.35)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 8
      ctx.beginPath()
      ctx.ellipse(0, 0, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (layer.type === 'image') {
      if (layer.img && layer.img.complete && layer.img.naturalWidth > 0) {
        ctx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h)
      } else {
        ctx.fillStyle = 'rgba(15,23,42,0.55)'
        ctx.fillRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h)
      }
    } else if (layer.type === 'text') {
      ctx.fillStyle = layer.fill
      ctx.font = `700 ${layer.fontSize}px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.shadowColor = 'rgba(2,6,23,0.45)'
      ctx.shadowBlur = 8
      ctx.fillText(layer.text || '', -layer.w / 2, -layer.h / 2 + layer.fontSize * 0.12)
    }

    ctx.restore()

    if (layer.id === state.selectedId) {
      ctx.save()
      ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2)
      ctx.rotate((layer.rot * Math.PI) / 180)
      ctx.setLineDash([7, 6])
      ctx.lineWidth = 2
      ctx.strokeStyle = '#5eead4'
      ctx.strokeRect(-layer.w / 2 - 5, -layer.h / 2 - 5, layer.w + 10, layer.h + 10)
      ctx.restore()
    }
  }

  function drawSparks (time) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const spark of sparks) {
      const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 2 + spark.phase))
      ctx.globalAlpha = 0.25 + 0.45 * pulse
      ctx.fillStyle = spark.color
      ctx.beginPath()
      ctx.arc(spark.x + Math.sin(time + spark.phase) * 6, spark.y, spark.r * (0.8 + pulse * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function render (time = performance.now() / 1000) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    drawBackground()
    for (const layer of state.layers) drawLayer(layer)
    if (state.running) drawSparks(time)
  }

  function hitTest (x, y) {
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i]
      const cx = layer.x + layer.w / 2
      const cy = layer.y + layer.h / 2
      const angle = (-layer.rot * Math.PI) / 180
      const dx = x - cx
      const dy = y - cy
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle)
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle)
      if (Math.abs(rx) <= layer.w / 2 && Math.abs(ry) <= layer.h / 2) return layer
    }
    return null
  }

  function pointFromEvent (event) {
    const rect = stage.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (WIDTH / rect.width),
      y: (event.clientY - rect.top) * (HEIGHT / rect.height)
    }
  }

  function renderLayerList () {
    layerList.innerHTML = ''
    if (!state.layers.length) {
      const empty = document.createElement('li')
      empty.className = 'muted'
      empty.style.cursor = 'default'
      empty.textContent = 'No layers yet.'
      layerList.appendChild(empty)
      return
    }
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i]
      const item = document.createElement('li')
      item.className = layer.id === state.selectedId ? 'selected' : ''
      item.dataset.id = String(layer.id)

      const swatch = document.createElement('span')
      swatch.className = 'swatch'
      swatch.style.background = layer.type === 'image' ? '#94a3b8' : (layer.fill || '#64748b')

      const name = document.createElement('span')
      name.textContent = layer.name

      const type = document.createElement('span')
      type.className = 'layer-type'
      type.textContent = layer.type

      item.append(swatch, name, type)
      item.addEventListener('click', () => select(layer.id))
      layerList.appendChild(item)
    }
  }

  function makeRow (labelText, input) {
    const row = document.createElement('div')
    row.className = 'row'
    const label = document.createElement('label')
    label.textContent = labelText
    row.append(label, input)
    return row
  }

  function makeRange (min, max, stepValue, value, onInput) {
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(stepValue)
    input.value = String(value)
    input.addEventListener('input', () => onInput(Number(input.value)))
    return input
  }

  function makeButton (label, className, onClick) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `btn ${className || ''}`.trim()
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
  }

  function renderProps () {
    propsBox.innerHTML = ''
    const layer = selectedLayer()
    if (!layer) {
      const note = document.createElement('p')
      note.className = 'muted'
      note.textContent = 'Select a layer to edit it.'
      propsBox.appendChild(note)
      return
    }

    const title = document.createElement('p')
    title.className = 'muted'
    title.textContent = `${layer.type} layer · #${layer.id}`
    propsBox.appendChild(title)

    if (layer.type === 'text') {
      const textInput = document.createElement('input')
      textInput.type = 'text'
      textInput.value = layer.text
      textInput.addEventListener('input', () => {
        layer.text = textInput.value
        layer.name = textInput.value.slice(0, 22) || 'Text'
        measureText(layer)
        refresh()
      })
      propsBox.appendChild(makeRow('Text', textInput))

      propsBox.appendChild(makeRow('Font size', makeRange(12, 140, 1, layer.fontSize, value => {
        layer.fontSize = value
        measureText(layer)
        refresh()
      })))
    }

    if (layer.type !== 'image') {
      const color = document.createElement('input')
      color.type = 'color'
      color.value = /^#[0-9a-f]{6}$/i.test(layer.fill) ? layer.fill : '#38bdf8'
      color.addEventListener('input', () => {
        layer.fill = color.value
        refresh()
      })
      propsBox.appendChild(makeRow('Color', color))
    }

    propsBox.appendChild(makeRow('Opacity', makeRange(0.1, 1, 0.05, layer.opacity, value => {
      layer.opacity = value
      refresh()
    })))

    propsBox.appendChild(makeRow('Rotation', makeRange(-180, 180, 1, layer.rot, value => {
      layer.rot = value
      refresh()
    })))

    const widthInput = document.createElement('input')
    widthInput.type = 'number'
    widthInput.min = '10'
    widthInput.max = String(WIDTH * 2)
    widthInput.value = String(Math.round(layer.w))
    widthInput.addEventListener('change', () => {
      layer.w = Math.max(10, Number(widthInput.value) || layer.w)
      refresh()
    })
    propsBox.appendChild(makeRow('Width', widthInput))

    const heightInput = document.createElement('input')
    heightInput.type = 'number'
    heightInput.min = '10'
    heightInput.max = String(HEIGHT * 2)
    heightInput.value = String(Math.round(layer.h))
    heightInput.addEventListener('change', () => {
      layer.h = Math.max(10, Number(heightInput.value) || layer.h)
      refresh()
    })
    propsBox.appendChild(makeRow('Height', heightInput))

    const buttons = document.createElement('div')
    buttons.className = 'button-row'
    buttons.append(
      makeButton('Bring forward', '', () => moveLayer(1)),
      makeButton('Send backward', '', () => moveLayer(-1)),
      makeButton('Duplicate', '', duplicateSelected),
      makeButton('Delete', 'btn-danger', deleteSelected)
    )
    propsBox.appendChild(buttons)
  }

  function moveLayer (delta) {
    const index = state.layers.findIndex(layer => layer.id === state.selectedId)
    if (index < 0) return
    const target = index + delta
    if (target < 0 || target >= state.layers.length) return
    const [layer] = state.layers.splice(index, 1)
    state.layers.splice(target, 0, layer)
    setStatus(`Moved ${layer.name}`)
    refresh()
  }

  function duplicateSelected () {
    const layer = selectedLayer()
    if (!layer) return
    const copy = { ...layer, id: state.nextId++, name: `${layer.name} copy`, x: layer.x + 24, y: layer.y + 24 }
    state.layers.push(copy)
    state.selectedId = copy.id
    setStatus(`Duplicated ${layer.name}`)
    refresh()
  }

  function deleteSelected () {
    const layer = selectedLayer()
    if (!layer) return
    state.layers = state.layers.filter(item => item.id !== layer.id)
    state.selectedId = state.layers.length ? state.layers[state.layers.length - 1].id : null
    setStatus(`Deleted ${layer.name}`)
    refresh()
  }

  function select (id) {
    state.selectedId = id
    const layer = selectedLayer()
    setStatus(layer ? `Selected ${layer.name}` : 'Ready')
    refresh()
  }

  function refresh () {
    render()
    renderLayerList()
    renderProps()
    countEl.textContent = `${state.layers.length} layer${state.layers.length === 1 ? '' : 's'}`
  }

  function addShape () {
    const fill = PALETTE[state.shapeIndex++ % PALETTE.length]
    const type = state.shapeIndex % 2 === 0 ? 'rect' : 'ellipse'
    const layer = {
      id: state.nextId++,
      type,
      name: type === 'rect' ? `Card ${state.shapeIndex}` : `Orb ${state.shapeIndex}`,
      x: 300 + Math.round(Math.random() * 240),
      y: 200 + Math.round(Math.random() * 180),
      w: 160 + Math.round(Math.random() * 80),
      h: 120 + Math.round(Math.random() * 80),
      rot: Math.round(Math.random() * 24 - 12),
      opacity: 1,
      fill
    }
    state.layers.push(layer)
    state.selectedId = layer.id
    setStatus(`Added ${layer.name}`)
    refresh()
  }

  function addText () {
    const layer = {
      id: state.nextId++, type: 'text', name: 'New text', text: 'New text',
      x: 320, y: 470, w: 160, h: 40, rot: 0, opacity: 1, fill: '#f8fafc', fontSize: 30
    }
    measureText(layer)
    state.layers.push(layer)
    state.selectedId = layer.id
    setStatus('Added text layer')
    refresh()
  }

  function addImage (file) {
    if (!file) return
    if (!/^image\//.test(file.type)) {
      setStatus('That file is not an image.')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const maxW = WIDTH * 0.4
      const maxH = HEIGHT * 0.4
      const scale = Math.min(1, maxW / image.naturalWidth, maxH / image.naturalHeight)
      const layer = {
        id: state.nextId++, type: 'image', name: file.name.slice(0, 24) || 'Image',
        img: image, x: 360, y: 170,
        w: Math.max(40, Math.round(image.naturalWidth * scale)),
        h: Math.max(40, Math.round(image.naturalHeight * scale)),
        rot: 0, opacity: 1, fill: '#94a3b8'
      }
      state.layers.push(layer)
      state.selectedId = layer.id
      setStatus(`Added ${layer.name}`)
      URL.revokeObjectURL(objectUrl)
      refresh()
    }
    image.onerror = () => {
      setStatus('Could not load that image.')
      URL.revokeObjectURL(objectUrl)
    }
    image.src = objectUrl
    fileInput.value = ''
  }

  function downloadStage () {
    const link = document.createElement('a')
    link.download = 'playground-studio.png'
    link.href = stage.toDataURL('image/png')
    link.click()
    setStatus('Exported playground-studio.png')
  }

  let animationFrame = 0

  function animationLoop () {
    if (!state.running) {
      animationFrame = 0
      return
    }
    const time = performance.now() / 1000
    for (const spark of sparks) {
      spark.y -= spark.speed
      if (spark.y < -20) {
        spark.y = HEIGHT + 20
        spark.x = Math.random() * WIDTH
      }
    }
    render(time)
    animationFrame = requestAnimationFrame(animationLoop)
  }

  function toggleRunning () {
    state.running = !state.running
    document.getElementById('btn-start').textContent = state.running ? 'Stop' : 'Start'
    setStatus(state.running ? 'Animation running' : 'Animation paused')
    if (state.running && !animationFrame) animationFrame = requestAnimationFrame(animationLoop)
    if (!state.running) render()
  }

  let drag = null

  stage.addEventListener('pointerdown', event => {
    const point = pointFromEvent(event)
    const layer = hitTest(point.x, point.y)
    if (!layer) {
      select(null)
      return
    }
    state.selectedId = layer.id
    drag = { layer, offsetX: point.x - layer.x, offsetY: point.y - layer.y }
    stage.setPointerCapture(event.pointerId)
    setStatus(`Dragging ${layer.name}`)
    refresh()
  })

  stage.addEventListener('pointermove', event => {
    if (!drag) return
    const point = pointFromEvent(event)
    const layer = drag.layer
    layer.x = Math.round(Math.max(-layer.w / 2, Math.min(WIDTH - layer.w / 2, point.x - drag.offsetX)))
    layer.y = Math.round(Math.max(-layer.h / 2, Math.min(HEIGHT - layer.h / 2, point.y - drag.offsetY)))
    render()
  })

  function endDrag () {
    if (!drag) return
    setStatus(`Moved ${drag.layer.name}`)
    drag = null
    refresh()
  }

  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', endDrag)

  document.getElementById('btn-start').addEventListener('click', toggleRunning)
  document.getElementById('btn-add-image').addEventListener('click', () => fileInput.click())
  document.getElementById('btn-add-text').addEventListener('click', addText)
  document.getElementById('btn-add-shape').addEventListener('click', addShape)
  document.getElementById('btn-clear').addEventListener('click', () => {
    state.layers = []
    state.selectedId = null
    setStatus('Canvas cleared')
    refresh()
  })
  document.getElementById('btn-download').addEventListener('click', downloadStage)
  fileInput.addEventListener('change', () => addImage(fileInput.files && fileInput.files[0]))

  seedScene()
  refresh()
  setStatus('Ready — press Start to animate')
})()

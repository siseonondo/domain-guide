(function () {
  // ---------- 코드 복사 ----------
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.dataset.copyTarget)
      if (!target) return
      var text = target.textContent
      var done = function (ok) {
        var original = btn.textContent
        btn.textContent = ok ? '복사됨' : '복사 실패'
        setTimeout(function () {
          btn.textContent = original
        }, 1600)
      }
      var fallback = function () {
        var area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        var ok = false
        try {
          ok = document.execCommand('copy')
        } catch (e) {
          ok = false
        }
        document.body.removeChild(area)
        done(ok)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          done(true)
        }, fallback)
      } else {
        fallback()
      }
    })
  })

  // ---------- 한 화면 한 페이지 ----------
  var pages = Array.prototype.slice.call(document.querySelectorAll('main .page'))
  if (!pages.length) return

  var stage = document.getElementById('main')
  var countEl = document.getElementById('pageCount')
  var barEl = document.getElementById('progressBar')
  var prevBtn = document.getElementById('prevBtn')
  var nextBtn = document.getElementById('nextBtn')
  var toc = document.getElementById('toc')
  var tocBtn = document.getElementById('tocBtn')
  var tocClose = document.getElementById('tocClose')
  var tocList = document.getElementById('tocList')
  var MIN_ZOOM = 0.72
  var MIN_ZOOM_PHONE = 0.82
  var MAX_ZOOM = 1.2
  var BASE_W = 1080
  var MIN_LOGICAL_W = 780
  var ALIASES = { practice: 'practice-1', top: 'intro' }
  var current = 0

  // 왼쪽 메뉴: 파워포인트처럼 모든 페이지의 작은 미리보기를 보여줍니다.
  var THUMB_BASE_W = 1000
  var sideList = document.getElementById('sideList')
  var sideLinks = []
  var thumbs = []
  pages.forEach(function (page, i) {
    var li = document.createElement('li')
    li.className = 'side-item'
    var a = document.createElement('a')
    a.href = '#' + page.id
    a.setAttribute('aria-label', i + 1 + '번 페이지: ' + (page.dataset.title || page.id))
    a.title = page.dataset.title || ''

    var num = document.createElement('span')
    num.className = 'side-num'
    num.textContent = String(i + 1)

    var box = document.createElement('span')
    box.className = 'side-thumb'
    box.setAttribute('aria-hidden', 'true')
    var clone = page.querySelector('.page-inner').cloneNode(true)
    clone.removeAttribute('id')
    clone.style.zoom = ''
    clone.style.maxWidth = ''
    clone.querySelectorAll('[id]').forEach(function (el) {
      el.removeAttribute('id')
    })
    clone.querySelectorAll('[data-copy-target]').forEach(function (el) {
      el.removeAttribute('data-copy-target')
    })
    clone.querySelectorAll('a, button').forEach(function (el) {
      var plain = document.createElement('span')
      plain.className = el.className
      plain.innerHTML = el.innerHTML
      el.replaceWith(plain)
    })
    clone.classList.add('thumb-inner')
    clone.setAttribute('inert', '')
    box.appendChild(clone)

    a.appendChild(num)
    a.appendChild(box)
    a.addEventListener('click', function (e) {
      e.preventDefault()
      show(i, true)
    })
    li.appendChild(a)
    sideList.appendChild(li)
    sideLinks.push(a)
    thumbs.push({ box: box, clone: clone })
  })

  function layoutThumbs() {
    thumbs.forEach(function (t) {
      var bw = t.box.clientWidth
      var bh = t.box.clientHeight
      if (!bw || !bh) return
      t.clone.style.transform = 'none'
      t.clone.style.width = THUMB_BASE_W + 'px'
      var h = t.clone.offsetHeight
      var s = Math.min(bw / THUMB_BASE_W, bh / h)
      var tx = (bw - THUMB_BASE_W * s) / 2
      var ty = (bh - h * s) / 2
      t.clone.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'
    })
  }

  // 목차 만들기
  var tocLinks = pages.map(function (page, i) {
    var li = document.createElement('li')
    var a = document.createElement('a')
    a.href = '#' + page.id
    a.innerHTML = '<span class="toc-num">' + (i + 1) + '</span><span></span>'
    a.lastChild.textContent = page.dataset.title || page.id
    a.addEventListener('click', function (e) {
      e.preventDefault()
      closeToc()
      show(i, true)
    })
    li.appendChild(a)
    tocList.appendChild(li)
    return a
  })

  // 화면 크기에 맞춰 내용을 키우거나 줄여서 한 화면을 알맞게 채웁니다.
  function fit(page) {
    var inner = page.querySelector('.page-inner')
    if (!inner) return
    var W = stage.clientWidth
    var H = stage.clientHeight - (stage.clientWidth > 700 ? 52 : 28)
    var wide = W > 760
    var maxZoom = wide ? Math.min(MAX_ZOOM, W / MIN_LOGICAL_W) : 1
    var minZ = wide ? MIN_ZOOM : MIN_ZOOM_PHONE
    var chosen = minZ
    for (var z = maxZoom; z >= minZ - 0.001; z -= 0.04) {
      inner.style.zoom = String(z)
      inner.style.maxWidth = Math.min(BASE_W, W / z) + 'px'
      if (inner.getBoundingClientRect().height <= H - 2) {
        chosen = z
        break
      }
    }
    inner.style.zoom = String(chosen)
    inner.style.maxWidth = Math.min(BASE_W, W / chosen) + 'px'
  }

  // 현재 페이지 썸네일을 왼쪽 메뉴의 세로 중앙에 맞춘다
  function centerSide(a, instant) {
    var box = document.getElementById('side')
    if (!box || !a) return
    var target = a.offsetTop + a.offsetHeight / 2 - box.clientHeight / 2
    if (box.scrollTo) box.scrollTo({ top: Math.max(0, target), behavior: instant ? 'auto' : 'smooth' })
    else box.scrollTop = Math.max(0, target)
  }

  function show(i, updateHash) {
    i = Math.max(0, Math.min(pages.length - 1, i))
    pages.forEach(function (p, k) {
      p.classList.toggle('is-active', k === i)
    })
    current = i
    var page = pages[i]
    page.scrollTop = 0
    fit(page)
    countEl.textContent = i + 1 + ' / ' + pages.length
    barEl.style.width = ((i + 1) / pages.length) * 100 + '%'
    prevBtn.disabled = i === 0
    nextBtn.disabled = i === pages.length - 1
    tocLinks.forEach(function (a, k) {
      if (k === i) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
    })
    sideLinks.forEach(function (a, k) {
      if (k === i) {
        a.setAttribute('aria-current', 'true')
        centerSide(a)
      } else {
        a.removeAttribute('aria-current')
      }
    })
    if (updateHash && history.replaceState) {
      history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + page.id)
    }
  }

  function fromHash() {
    var id = decodeURIComponent(location.hash.replace(/^#/, ''))
    id = ALIASES[id] || id
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].id === id) return i
    }
    return 0
  }

  function next() {
    show(current + 1, true)
  }
  function prev() {
    show(current - 1, true)
  }

  prevBtn.addEventListener('click', prev)
  nextBtn.addEventListener('click', next)

  function openToc() {
    toc.hidden = false
    tocClose.focus()
  }
  function closeToc() {
    toc.hidden = true
    tocBtn.focus()
  }
  tocBtn.addEventListener('click', openToc)
  tocClose.addEventListener('click', closeToc)
  toc.addEventListener('click', function (e) {
    if (e.target === toc) closeToc()
  })

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (!toc.hidden) {
      if (e.key === 'Escape') closeToc()
      return
    }
    if (e.target && e.target.id === 'sideResizer') return
    var tag = (e.target && e.target.tagName) || ''
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      prev()
    } else if (e.key === 'Home') {
      e.preventDefault()
      show(0, true)
    } else if (e.key === 'End') {
      e.preventDefault()
      show(pages.length - 1, true)
    }
  })

  // 터치 스와이프
  var sx = 0
  var sy = 0
  stage.addEventListener(
    'touchstart',
    function (e) {
      sx = e.changedTouches[0].clientX
      sy = e.changedTouches[0].clientY
    },
    { passive: true }
  )
  stage.addEventListener(
    'touchend',
    function (e) {
      var dx = e.changedTouches[0].clientX - sx
      var dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        if (dx < 0) next()
        else prev()
      }
    },
    { passive: true }
  )

  window.addEventListener('hashchange', function () {
    show(fromHash(), false)
  })
  window.addEventListener('resize', function () {
    fit(pages[current])
    layoutThumbs()
  })
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      fit(pages[current])
      layoutThumbs()
    })
  }

  // ---------- 왼쪽 메뉴 너비 조절 ----------
  var side = document.getElementById('side')
  var resizer = document.getElementById('sideResizer')
  var STORE_KEY = 'colab_side_width'
  var MIN_SIDE = 200

  function maxSide() {
    return Math.floor(window.innerWidth * 0.5)
  }
  function applySide(px, save) {
    px = Math.max(MIN_SIDE, Math.min(maxSide(), Math.round(px)))
    document.documentElement.style.setProperty('--side-w', px + 'px')
    if (save) {
      try {
        localStorage.setItem(STORE_KEY, String(px))
      } catch (e) {}
    }
    scheduleRelayout()
  }
  function resetSide() {
    document.documentElement.style.removeProperty('--side-w')
    try {
      localStorage.removeItem(STORE_KEY)
    } catch (e) {}
    scheduleRelayout()
  }
  var relayoutQueued = false
  function scheduleRelayout() {
    if (relayoutQueued) return
    relayoutQueued = true
    requestAnimationFrame(function () {
      relayoutQueued = false
      fit(pages[current])
      layoutThumbs()
    })
  }

  try {
    var saved = parseInt(localStorage.getItem(STORE_KEY), 10)
    if (saved >= MIN_SIDE) applySide(saved, false)
  } catch (e) {}

  if (resizer) {
    var dragging = false
    resizer.addEventListener('pointerdown', function (e) {
      dragging = true
      document.body.classList.add('is-resizing')
      try {
        resizer.setPointerCapture(e.pointerId)
      } catch (err) {}
      e.preventDefault()
    })
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return
      applySide(e.clientX - side.getBoundingClientRect().left, false)
    })
    function endDrag() {
      if (!dragging) return
      dragging = false
      document.body.classList.remove('is-resizing')
      applySide(side.getBoundingClientRect().width, true)
    }
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    resizer.addEventListener('dblclick', resetSide)
    resizer.addEventListener('keydown', function (e) {
      var w = side.getBoundingClientRect().width
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        applySide(w - 16, true)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        applySide(w + 16, true)
      } else if (e.key === 'Home' || e.key === 'Escape') {
        e.preventDefault()
        resetSide()
      }
    })
  }

  show(fromHash(), false)
  layoutThumbs()
  centerSide(sideLinks[current], true)
  window.addEventListener('load', function () {
    centerSide(sideLinks[current], true)
  })
})()

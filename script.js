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
  var MIN_ZOOM = 1
  var MIN_ZOOM_PHONE = 1
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

  // 한 줄로 이어지는 스크롤 방식: 페이지를 늘리거나 줄이지 않습니다.
  function fit() {}

  // 현재 페이지 썸네일을 왼쪽 메뉴의 세로 중앙에 맞춘다
  function centerSide(a, instant) {
    var box = document.getElementById('side')
    if (!box || !a) return
    var target = a.offsetTop + a.offsetHeight / 2 - box.clientHeight / 2
    if (box.scrollTo) box.scrollTo({ top: Math.max(0, target), behavior: instant ? 'auto' : 'smooth' })
    else box.scrollTop = Math.max(0, target)
  }

  var lockUntil = 0
  function setActive(i) {
    current = i
    countEl.textContent = i + 1 + ' / ' + pages.length
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
  }

  // 해당 페이지 위치로 스크롤해서 이동
  function show(i, updateHash, instant) {
    i = Math.max(0, Math.min(pages.length - 1, i))
    var page = pages[i]
    lockUntil = Date.now() + 700
    setActive(i)
    stage.scrollTo({ top: page.offsetTop, behavior: instant ? 'auto' : 'smooth' })
    if (updateHash && history.replaceState) {
      history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + page.id)
    }
  }

  function detect() {
    if (Date.now() < lockUntil) return
    var y = stage.scrollTop + stage.clientHeight * 0.35
    var idx = 0
    for (var k = 0; k < pages.length; k++) {
      if (pages[k].offsetTop <= y) idx = k
    }
    if (stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 4) idx = pages.length - 1
    if (idx !== current) setActive(idx)
  }

  function fromHash() {
    var id = decodeURIComponent(location.hash.replace(/^#/, ''))
    id = ALIASES[id] || id
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].id === id) return i
    }
    return 0
  }



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
    if (!toc.hidden && e.key === 'Escape') closeToc()
  })

  // 스크롤 위치에 맞춰 현재 위치(번호·왼쪽 메뉴·목차)를 갱신
  stage.addEventListener('scroll', detect, { passive: true })

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

  stage.setAttribute('tabindex', '-1')
  show(fromHash(), false, true)
  layoutThumbs()
  centerSide(sideLinks[current], true)
  window.addEventListener('load', function () {
    // 글꼴이 다 불러와지면 높이가 달라지므로, 주소에 위치가 있으면 한 번 더 맞춥니다.
    if (location.hash) show(fromHash(), false, true)
    centerSide(sideLinks[current], true)
    try {
      stage.focus({ preventScroll: true })
    } catch (e) {}
  })
})()

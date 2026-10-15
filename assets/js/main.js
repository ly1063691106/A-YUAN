/* 阿缘摄影 · 前端主逻辑
 * 全站零第三方库。首屏显影引擎为手写 Canvas 2D。
 * 数据来源：data/photos.js（由 build.py 生成）、data/content.js（你手改）
 */
(function () {
  'use strict';

  var RM   = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ==========================================================
     1 · 首屏显影引擎
     暗房里两件事在动：一片暖灰的墨雾慢慢化开，一盏安全灯在角落亮着，
     空气里浮着极细的银盐尘。它是装饰层，删掉之后页面照样能读。
     ========================================================== */
  function developer() {
    var cv = document.getElementById('developer');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, DPR = 1, raf = 0, t0 = performance.now();
    var blooms = [], dust = [];

    function sprite(rgb, inner) {
      var s = 256, o = document.createElement('canvas');
      o.width = o.height = s;
      var c = o.getContext('2d');
      var g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(' + rgb + ',' + inner + ')');
      g.addColorStop(0.45, 'rgba(' + rgb + ',' + (inner * 0.36) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      return o;
    }
    var HAZE = sprite('74,60,50', 0.55);      // 暖灰墨雾，比底色亮，才看得见
    var SAFE = sprite('178,66,42', 0.34);     // 安全灯的暗房红

    function seed() {
      blooms = [];
      var n = 7;
      for (var i = 0; i < n; i++) {
        blooms.push({
          x: (0.10 + 0.80 * ((i * 0.618) % 1)) * W,
          y: (0.14 + 0.72 * ((i * 0.382 + 0.21) % 1)) * H,
          r: (0.26 + 0.32 * ((i * 0.7) % 1)) * Math.max(W, H),
          red: i % 3 === 1,
          delay: i * 150,
          dur: 2100 + ((i * 331) % 900),
          ph: i * 1.7
        });
      }
      dust = [];
      var m = Math.round(Math.min(110, Math.max(44, W / 16)));
      for (var j = 0; j < m; j++) {
        dust.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 0.5 + Math.random() * 1.3,
          v: 0.05 + Math.random() * 0.2,
          a: 0.05 + Math.random() * 0.12,
          ph: Math.random() * 6.283
        });
      }
    }

    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }

    function ease(t) { return 1 - Math.pow(1 - t, 3); }

    function paint(t, loop) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < blooms.length; i++) {
        var b = blooms[i];
        var p = (t - b.delay) / b.dur;
        if (p <= 0) continue;
        if (p > 1) p = 1;
        var e = ease(p), rr = b.r * e;
        var dx = Math.sin(t / 9000 + b.ph) * 16;
        var dy = Math.cos(t / 11000 + b.ph) * 13;
        ctx.globalAlpha = (b.red ? 0.42 : 0.78) * e;
        ctx.drawImage(b.red ? SAFE : HAZE, b.x - rr + dx, b.y - rr + dy, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1;
      for (var j = 0; j < dust.length; j++) {
        var d = dust[j];
        if (loop) {
          d.y -= d.v;
          if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
        }
        var a = d.a * (0.6 + 0.4 * Math.sin(t / 1400 + d.ph));
        ctx.fillStyle = 'rgba(239,235,228,' + a.toFixed(3) + ')';
        ctx.fillRect(d.x, d.y, d.r, d.r);
      }
    }

    function loop(now) {
      paint(now - t0, true);
      raf = requestAnimationFrame(loop);
    }

    size();
    if (RM) {
      paint(4200, false);                    // 静止版：显影完成的那一帧
    } else {
      raf = requestAnimationFrame(loop);
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        cancelAnimationFrame(raf);
        size();
        if (RM) paint(4200, false);
        else raf = requestAnimationFrame(loop);
      }, 220);
    });
    document.addEventListener('visibilitychange', function () {
      if (RM) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    });
  }

  /* ==========================================================
     2 · 首屏揭幕（只做一次）
     js-anim 现在无条件加：一次性、低幅度的进场显影对所有人保留
     （含系统关动效的用户——那部分会由 CSS 降级成纯淡入零位移）。
     真正跟随系统设置的是持续运动的装饰：Ken Burns、Canvas 墨雾、
     logo 扫光、循环下滑箭头（各自在 CSS 的 RM 块里定格）。
     ========================================================== */
  function intro() {
    document.documentElement.classList.add('js-anim');
  }

  /* ==========================================================
     2b · 首屏精选轮播：5–10 张精选作品自动换
     6 秒一张，交叉溶解；左右箭头手动切换，切完重新计时。
     注意：不管系统是否开了「减少动态效果」，轮播都照常走——
     这是内容切换，不是装饰动画；推近效果（Ken Burns）才跟随系统设置。
     ========================================================== */
  function heroCarousel(list) {
    var stage = document.getElementById('heroStage');
    var counter = document.getElementById('heroCount');
    var prevBtn = document.getElementById('heroPrev');
    var nextBtn = document.getElementById('heroNext');
    if (!stage) return;
    var picks = list.slice(0, 10);
    if (!picks.length) { stage.hidden = true; return; }

    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function setCount(n) {
      if (counter) counter.textContent = pad2(n + 1) + ' / ' + pad2(picks.length);
    }

    var slides = picks.map(function (p, i) {
      var d = document.createElement('div');
      d.className = 'hero__slide';
      if (p.lqip) d.style.backgroundImage = 'url("' + p.lqip + '")';
      var img = document.createElement('img');
      img.src = p.l;                         // 首屏值得用大图
      img.alt = '';
      img.decoding = 'async';
      img.loading = i < 3 ? 'eager' : 'lazy';
      d.appendChild(img);
      stage.appendChild(d);
      return d;
    });

    var cur = 0;
    slides[0].classList.add('is-on');
    setCount(0);

    function go(n) {
      if (n === cur) return;
      slides[cur].classList.remove('is-on');
      cur = ((n % slides.length) + slides.length) % slides.length;
      slides[cur].classList.add('is-on');
      setCount(cur);
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { go(cur + 1); }, 6000);
    }
    var timer = 0;

    if (slides.length > 1) {
      if (prevBtn) prevBtn.addEventListener('click', function () { go(cur - 1); restart(); });
      if (nextBtn) nextBtn.addEventListener('click', function () { go(cur + 1); restart(); });
      restart();
      // 切去别的页签时暂停，回来自动续
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) clearInterval(timer); else restart();
      });
    }
  }

  /* ==========================================================
     2c · 进场显影：带 .rv 的元素进入视口时加 is-in，只此一次
     隐藏态的样式收在 .js-anim 作用域里，系统关动效或 JS 挂掉时
     内容天生可见，只是不动。
     ========================================================== */
  function reveals() {
    var nav = document.getElementById('nav');
    if (nav) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { nav.classList.add('is-in'); });
      });
    }
    var els = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (e) { e.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('is-in');
          io.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  }

  /* ==========================================================
     3 · 导航条在滚动后落底
     ========================================================== */
  function navSolid() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var on = false;
    function check() {
      var s = window.scrollY > 60;
      if (s !== on) { on = s; nav.classList.toggle('is-solid', on); }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  /* ==========================================================
     4 · 横向底片轨：滚动位置驱动横向位移，不劫持滚动速度
     ========================================================== */
  function rail() {
    var sec = document.getElementById('rail');
    var track = document.getElementById('railTrack');
    var bar = document.getElementById('railBar');
    if (!sec || !track) return;
    var ticking = false;

    function apply() {
      ticking = false;
      if (window.innerWidth <= 760) return;   // 手机上由 CSS 切成原生横滑
      var rect = sec.getBoundingClientRect();
      var span = sec.offsetHeight - window.innerHeight;
      if (span <= 0) return;
      var p = Math.max(0, Math.min(1, -rect.top / span));
      var max = track.scrollWidth - window.innerWidth;
      if (max <= 0) return;
      track.style.transform = 'translate3d(' + (-p * max).toFixed(1) + 'px,0,0)';
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', apply);
    apply();
  }

  /* ==========================================================
     5 · 作品列表
     ========================================================== */
  /* ==========================================================
     5b · 接触印样排版：齐边行（Pixabay 式）
     每行塞若干张，行高 = 行宽 ÷ 行内宽高比之和，恰好撑满行宽；
     一张的真实横竖比例全部保留（极端比例做少量裁切保行齐），
     间隙 4px，手机 3px。筛选、排序、翻页后重新计算。
     ========================================================== */
  var PAGE = 36;
  var GAP = 4;
  var state = { filter: 'all', sort: 'date', shown: PAGE, list: [], views: {}, rendered: [] };

  function views() {
    try { return JSON.parse(localStorage.getItem('ay_views') || '{}'); }
    catch (e) { return {}; }
  }
  function bumpView(id) {
    var v = views();
    v[id] = (v[id] || 0) + 1;
    state.views = v;
    try { localStorage.setItem('ay_views', JSON.stringify(v)); } catch (e) {}
  }

  function photoDate(p) { return p.taken || p.date || ''; }

  function filtered() {
    var list = state.list.slice();
    if (state.filter === 'featured') list = list.filter(function (p) { return p.featured; });
    else if (state.filter === 'l' || state.filter === 'p') list = list.filter(function (p) { return p.o === state.filter; });
    else if (state.filter === 'video') list = [];

    if (state.sort === 'pinned') {
      list.sort(function (a, b) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
               photoDate(b).localeCompare(photoDate(a));
      });
    } else if (state.sort === 'views') {
      var v = state.views;
      list.sort(function (a, b) { return (v[b.id] || 0) - (v[a.id] || 0); });
    } else {
      list.sort(function (a, b) {
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
               photoDate(b).localeCompare(photoDate(a));
      });
    }
    return list;
  }

  function shotEl(p, idx) {
    var fig = document.createElement('button');
    fig.type = 'button';
    fig.className = 'shot';
    fig.setAttribute('data-id', p.id);
    fig.setAttribute('aria-label', '查看照片 ' + (idx + 1));
    if (p.lqip) fig.style.backgroundImage = 'url("' + p.lqip + '")';
    fig.style.animationDelay = Math.min(idx, 22) * 26 + 'ms';

    var img = document.createElement('img');
    img.src = p.t;
    img.alt = (p.albumLabel || '作品') + ' ' + (idx + 1);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 900; img.height = 900;
    fig.appendChild(img);

    if (p.featured) {
      var tag = document.createElement('span');
      tag.className = 'shot__tag';
      tag.textContent = '精选';
      fig.appendChild(tag);
    } else if (p.pinned) {
      var pin = document.createElement('span');
      pin.className = 'shot__pin';
      fig.appendChild(pin);
    }
    return fig;
  }

  function layoutShots(grid, slice) {
    var cw = grid.clientWidth;
    if (!cw || !slice.length) return;
    var target = cw > 1024 ? 300 : (cw > 760 ? 240 : 130);   // 行高基准

    // 分行：累到行高落到基准以下，这一行就满了
    var rows = [], cur = [], sum = 0;
    for (var i = 0; i < slice.length; i++) {
      var p = slice[i];
      var r = Math.min(2.4, Math.max(0.42, p.w / p.h));      // 极端比例先约束住
      cur.push(r); sum += r;
      if ((cw - GAP * (cur.length - 1)) / sum <= target) {
        rows.push(cur); cur = []; sum = 0;
      }
    }
    if (cur.length) rows.push(cur);

    var frag = document.createDocumentFragment();
    var idx = 0;
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri], n = row.length;
      var s = 0;
      for (var k = 0; k < n; k++) s += row[k];
      var h = (cw - GAP * (n - 1)) / s;
      // 最后一行不硬撑：如果撑满会把图放得过大，就按基准行高左对齐
      var stretch = true;
      if (ri === rows.length - 1 && h > target * 1.35) {
        h = target * 1.35;
        stretch = false;
      }
      var rowEl = document.createElement('div');
      rowEl.className = 'grid__row';
      for (var k2 = 0; k2 < n; k2++) {
        var ph = slice[idx], rr = row[k2];
        var el = shotEl(ph, idx);
        el.style.width = (h * rr).toFixed(2) + 'px';
        el.style.aspectRatio = rr.toFixed(4);
        if (stretch && k2 === n - 1) el.style.flexGrow = '1'; // 吃掉累积余数，行右缘齐边
        rowEl.appendChild(el);
        idx++;
      }
      frag.appendChild(rowEl);
    }
    grid.textContent = '';
    grid.appendChild(frag);
  }

  function renderGrid() {
    var grid = document.getElementById('grid');
    var empty = document.getElementById('gridEmpty');
    var more = document.getElementById('moreBtn');
    var count = document.getElementById('worksCount');
    var all = filtered();

    count.textContent = '共 ' + all.length + ' 张';

    if (!all.length) {
      grid.textContent = '';
      state.rendered = [];
      empty.hidden = false;
      more.hidden = true;
      return;
    }
    empty.hidden = true;

    var slice = all.slice(0, state.shown);
    state.rendered = slice;
    layoutShots(grid, slice);
    more.hidden = all.length <= state.shown;
  }

  function applyGrid() {
    if (document.startViewTransition && !RM) {
      document.startViewTransition(renderGrid);
    } else {
      renderGrid();
    }
  }

  /* ==========================================================
     6 · 灯箱
     ========================================================== */
  var lbState = { list: [], i: 0 };

  function lbOpen(list, i) {
    var lb = document.getElementById('lb');
    lbState.list = list; lbState.i = i;
    if (!lb.classList.contains('is-open')) {
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add('is-open'); });
    }
    lbFill();
    document.body.style.overflow = 'hidden';
    document.getElementById('lbClose').focus();
  }
  function lbFill() {
    var p = lbState.list[lbState.i];
    if (!p) return;
    var caps = (window.AY_CONTENT && window.AY_CONTENT.captions) || {};
    var cap = caps[(p.src || '').split('/').pop()] || {};
    var img = document.getElementById('lbImg');
    img.src = p.l;
    img.alt = (p.albumLabel || '') + ' 作品';
    document.getElementById('lbCaption').textContent = cap.text || '';
    document.getElementById('lbAlbum').textContent = p.albumLabel || '';
    document.getElementById('lbTaken').textContent = photoDate(p) || '';
    document.getElementById('lbCam').textContent = p.cam || '';
    var linkP = document.getElementById('lbLink');
    if (cap.link) {
      linkP.textContent = '';
      var a = document.createElement('a');
      a.href = cap.link; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = '查看详情';
      linkP.appendChild(a);
      linkP.hidden = false;
    } else { linkP.hidden = true; }

    var navs = [document.getElementById('lbPrev'), document.getElementById('lbNext')];
    navs.forEach(function (n) { n.hidden = lbState.list.length < 2; });
    bumpView(p.id);
  }
  function lbStep(d) {
    var n = lbState.list.length;
    if (!n) return;
    lbState.i = (lbState.i + d + n) % n;
    lbFill();
  }
  function lbClose() {
    var lb = document.getElementById('lb');
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(function () { if (!lb.classList.contains('is-open')) lb.hidden = true; }, 450);
  }

  function lightbox() {
    var lb = document.getElementById('lb');
    document.getElementById('lbClose').addEventListener('click', lbClose);
    document.getElementById('lbPrev').addEventListener('click', function (e) { e.stopPropagation(); lbStep(-1); });
    document.getElementById('lbNext').addEventListener('click', function (e) { e.stopPropagation(); lbStep(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') lbClose();
      else if (e.key === 'ArrowLeft') lbStep(-1);
      else if (e.key === 'ArrowRight') lbStep(1);
    });

    document.getElementById('grid').addEventListener('click', function (e) {
      var fig = e.target.closest('.shot');
      if (!fig) return;
      var list = filtered().slice(0, state.shown);
      var i = list.findIndex(function (p) { return p.id === fig.getAttribute('data-id'); });
      lbOpen(list, Math.max(0, i));
    });

    document.getElementById('railTrack').addEventListener('click', function (e) {
      var fig = e.target.closest('.frame');
      if (!fig) return;
      var list = (window.AY_PHOTOS.featured || []);
      var i = list.findIndex(function (p) { return p.id === fig.getAttribute('data-id'); });
      lbOpen(list, Math.max(0, i));
    });
  }

  /* ==========================================================
     7 · 数据装配
     ========================================================== */
  function buildRail(list) {
    var track = document.getElementById('railTrack');
    if (!track) return;
    var frag = document.createDocumentFragment();
    list.forEach(function (p, i) {
      var fig = document.createElement('button');
      fig.type = 'button';
      fig.className = 'frame frame--' + p.o;
      fig.setAttribute('data-id', p.id);
      fig.setAttribute('aria-label', (p.albumLabel || '精选') + ' 第 ' + (i + 1) + ' 张');

      var img = document.createElement('img');
      img.src = p.t;
      img.alt = (p.albumLabel || '精选') + ' 第 ' + (i + 1) + ' 张';
      img.loading = i < 4 ? 'eager' : 'lazy';
      img.decoding = 'async';
      fig.appendChild(img);

      var no = document.createElement('span');
      no.className = 'frame__no';
      no.textContent = p.id.toUpperCase();
      fig.appendChild(no);

      var caps = (window.AY_CONTENT && window.AY_CONTENT.captions) || {};
      var cap = caps[(p.src || '').split('/').pop()];
      if (cap && cap.text) {
        var c = document.createElement('span');
        c.className = 'frame__cap';
        c.textContent = cap.text;
        fig.appendChild(c);
      }
      frag.appendChild(fig);
    });
    track.textContent = '';
    track.appendChild(frag);
  }

  function buildCraft() {
    var list = document.getElementById('craftList');
    var items = (window.AY_CONTENT && window.AY_CONTENT.craft) || [];
    if (!list || !items.length) return;
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'craft__item rv';

      var en = document.createElement('p');
      en.className = 'craft__en';
      en.textContent = it.en || '';
      li.appendChild(en);

      var mid = document.createElement('div');
      var h = document.createElement('h3');
      h.className = 'craft__name';
      h.textContent = it.title;
      mid.appendChild(h);
      if (it.tags && it.tags.length) {
        var tw = document.createElement('div');
        tw.className = 'craft__tags';
        it.tags.forEach(function (t) {
          var s = document.createElement('span');
          s.textContent = t;
          tw.appendChild(s);
        });
        mid.appendChild(tw);
      }
      li.appendChild(mid);

      var body = document.createElement('p');
      body.className = 'craft__body';
      body.textContent = it.body || '';
      li.appendChild(body);

      frag.appendChild(li);
    });
    list.textContent = '';
    list.appendChild(frag);
  }

  function boot() {
    var D = window.AY_PHOTOS;
    if (!D || !D.photos) {
      document.getElementById('grid').textContent = '';
      document.getElementById('gridEmpty').hidden = false;
      document.getElementById('gridEmpty').textContent =
        '没有读到作品数据。先在项目目录里运行一次 build.bat 生成 data/photos.js。';
      return;
    }
    state.list = D.photos;
    state.views = views();

    var featured = D.photos.filter(function (p) { return p.featured; });
    if (!featured.length) featured = D.photos.slice(0, 12);
    window.AY_PHOTOS.featured = featured;

    // 首屏轮播：精选不够 5 张时，从其余作品里补足
    var picks = featured.slice(0, 10);
    if (picks.length < 5) {
      for (var i = 0; i < D.photos.length && picks.length < 5; i++) {
        if (picks.indexOf(D.photos[i]) === -1) picks.push(D.photos[i]);
      }
    }
    heroCarousel(picks);

    buildRail(featured);
    buildCraft();

    document.getElementById('worksCount').textContent = '共 ' + D.stats.total + ' 张';
    applyGrid();
    rail();
    lightbox();

    // 窗口宽度变了，行宽要重算（筛选结果不变，只重新排版）
    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (state.rendered.length) {
          layoutShots(document.getElementById('grid'), state.rendered);
        }
      }, 180);
    });
  }

  /* ---- 顶部按钮绑定 ---- */
  function bind() {
    var chips = document.querySelectorAll('.chip');
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener('click', function () {
        Array.prototype.forEach.call(chips, function (o) {
          o.classList.remove('is-on');
          o.setAttribute('aria-selected', 'false');
        });
        c.classList.add('is-on');
        c.setAttribute('aria-selected', 'true');
        state.filter = c.getAttribute('data-filter');
        state.shown = PAGE;
        applyGrid();
      });
    });
    var sb = document.getElementById('sortBy');
    if (sb) sb.addEventListener('change', function () {
      state.sort = sb.value; state.shown = PAGE; applyGrid();
    });
    var more = document.getElementById('moreBtn');
    if (more) more.addEventListener('click', function () {
      state.shown += PAGE;
      renderGrid();
    });
  }

  /* ==========================================================
     8 · 一键复制
     手机能拨号，但要加微信需要的是那串数字；邮件同理，粘到邮箱客户端更顺。
     剪贴板接口在非安全上下文里不给用，所以备一条 execCommand 的老路。
     ========================================================== */
  function copiers() {
    var btns = document.querySelectorAll('.copy');
    Array.prototype.forEach.call(btns, function (btn) {
      var label = btn.textContent;
      var timer = 0;

      function settle(ok) {
        clearTimeout(timer);
        btn.textContent = ok ? '已复制' : '复制失败';
        btn.classList.toggle('is-done', ok);
        btn.classList.toggle('is-fail', !ok);
        timer = setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove('is-done', 'is-fail');
        }, 1900);
      }
      function legacy(v) {
        var ta = document.createElement('textarea');
        ta.value = v;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        settle(ok);
      }

      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-copy') || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(v).then(function () { settle(true); },
            function () { legacy(v); });
        } else {
          legacy(v);
        }
      });
    });
  }

  function start() {
    intro();
    navSolid();
    developer();
    bind();
    copiers();
    boot();
    reveals();   // 必须在 boot() 之后：craft 列表由 boot 动态生成，先有元素才能观察
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

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
    // 同一张作品可以在首图、底片轨、网格多处展示 ——
    // 但各处引用的都是同一份文件（缩略图 t / 大图 l），不会生成第二份副本。
    if (state.filter === 'featured') list = list.filter(function (p) { return p.featured; });
    else if (state.filter === 'video') list = list.filter(function (p) { return p.v; });
    else if (state.filter === 'l' || state.filter === 'p') list = list.filter(function (p) { return p.o === state.filter; });

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

  function fmtDur(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function shotEl(p, idx) {
    var fig = document.createElement('button');
    fig.type = 'button';
    fig.className = 'shot' + (p.v ? ' shot--video' : '');
    fig.setAttribute('data-id', p.id);
    fig.setAttribute('aria-label', (p.v ? '播放视频 ' : '查看照片 ') + (idx + 1));
    if (p.lqip) fig.style.backgroundImage = 'url("' + p.lqip + '")';
    fig.style.animationDelay = Math.min(idx, 22) * 26 + 'ms';

    var img = document.createElement('img');
    img.src = p.t;
    img.alt = (p.albumLabel || '作品') + ' ' + (idx + 1);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = p.w; img.height = p.h;
    fig.appendChild(img);

    if (p.v) {
      var play = document.createElement('span');
      play.className = 'shot__play';
      play.innerHTML =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M8 5.4v13.2L19 12z"/></svg>';
      fig.appendChild(play);
      if (p.dur) {
        var d = document.createElement('span');
        d.className = 'shot__dur';
        d.textContent = fmtDur(p.dur);
        fig.appendChild(d);
      }
    }

    if (p.featured) {
      var tag = document.createElement('span');
      tag.className = 'shot__tag';
      tag.setAttribute('role', 'img');
      tag.setAttribute('aria-label', '精选作品');
      tag.title = '精选';
      tag.innerHTML =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 2.6l2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.2l-5.72 3.01 1.09-6.37-4.63-4.51 6.4-.93z"/>' +
        '</svg>';
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
    var cap = p._cap || caps[(p.src || '').split('/').pop()] || {};
    var img = document.getElementById('lbImg');
    var vid = document.getElementById('lbVideo');

    // 视频：点击那一刻才设置 src（即此刻才开始下载），其余视频从不加载
    if (p.v) {
      img.hidden = true;
      vid.hidden = false;
      vid.poster = p.t || '';
      vid.src = p.v;
      vid.currentTime = 0;
      var pp = vid.play();
      if (pp && pp.catch) pp.catch(function () {});   // 自动播放被拦时静默降级为手动点播
    } else {
      if (!vid.hidden) {                              // 离开视频项：停播并彻底释放
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        vid.hidden = true;
      }
      img.hidden = false;
      img.src = p.l;
      img.alt = (p.albumLabel || '') + ' 作品';
    }

    document.getElementById('lbCaption').textContent = cap.text || (p.v ? (p.albumLabel || '') + ' · 视频作品' : '');
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
    var vid = document.getElementById('lbVideo');
    if (vid && !vid.hidden) {                  // 关灯箱：停播并释放视频
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
      vid.hidden = true;
      document.getElementById('lbImg').hidden = false;
    }
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
     7b · 作品配置自动拉取（后台管理的数据源）
     overrides.json 由本地后台管理页（admin.html）生成并提交到
     GitHub 仓库；这里按 同源 → raw → jsDelivr 顺序拉取，
     谁先成功用谁，全部失败就静默沿用构建时的静态配置。
     ========================================================== */
  var OVERRIDE_SOURCES = [
    'data/overrides.json',
    'https://raw.githubusercontent.com/ly1063691106/A-YUAN/main/data/overrides.json',
    'https://cdn.jsdelivr.net/gh/ly1063691106/A-YUAN@main/data/overrides.json'
  ];
  function baseName(p) { return (p.src || '').split('/').pop(); }

  function applyOverrides(o) {
    if (!o || (!o.featured && !o.captions)) return;
    var byName = {};
    state.list.forEach(function (p) { byName[baseName(p)] = p; });
    if (o.featured && o.featured.length) {      // 空名单不覆盖静态精选（兜底）
      state.list.forEach(function (p) { p.featured = false; });
      o.featured.forEach(function (name) {
        if (byName[name]) byName[name].featured = true;
      });
    }
    var caps = o.captions || {};
    state.list.forEach(function (p) { p._cap = caps[baseName(p)] || null; });

    var featured = state.list.filter(function (p) { return p.featured; });
    if (!featured.length) featured = state.list.slice(0, 12);
    window.AY_PHOTOS.featured = featured;
    buildRail(featured);                       // 底片轨随新精选重建
    if (window.AY_REFRESH_CRAFT) window.AY_REFRESH_CRAFT();   // 擅长区右侧照片池也跟着精选走
    applyGrid();                               // 网格重排（保留当前筛选/页数）
  }

  function loadOverrides() {
    var i = 0;
    function tryNext() {
      if (i >= OVERRIDE_SOURCES.length) return;
      var url = OVERRIDE_SOURCES[i++] + '?v=' + Date.now();
      var opt = {};
      var timer = 0;
      if ('AbortController' in window) {
        opt.signal = new AbortController().signal;
        timer = setTimeout(function () { try { opt.signal.abort(); } catch (e) {} }, 6000);
      }
      fetch(url, opt).then(function (r) {
        clearTimeout(timer);
        return r.ok ? r.json() : Promise.reject(new Error(r.status));
      }).then(function (o) {
        if (o && (o.featured || o.captions)) applyOverrides(o);
      }).catch(function () { clearTimeout(timer); tryNext(); });
    }
    tryNext();
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
      var cap = p._cap || caps[(p.src || '').split('/').pop()];
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

  /* ==========================================================
     6b · 擅长区：每个方向一行，右侧是该方向的作品横条 + 箭头
     ========================================================== */
  var ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function domainKeyOf(title) {
    if (!title) return '';
    if (title.indexOf('婚礼') >= 0) return '婚礼';
    if (title.indexOf('活动') >= 0) return '活动';
    if (title.indexOf('儿童') >= 0) return '儿童';
    if (title.indexOf('产品') >= 0) return '产品';
    return '';
  }

  /* 该方向的精选作品：只取精选（在后台勾选的），不再用普通照片凑数 */
  function domainPool(key, limit) {
    if (!key) return [];
    var feat = state.list.filter(function (p) {
      return p.featured && (p.albumLabel || '').indexOf(key) >= 0;
    });
    return feat.slice(0, limit || 24);
  }

  function buildStrip(media, pool) {
    var strip = document.createElement('div');
    strip.className = 'craft__strip';
    pool.forEach(function (p, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-tile' + (p.v ? ' cs-tile--video' : '');
      b.setAttribute('aria-label', (p.v ? '播放视频 ' : '看大图 ') + (p.albumLabel || ''));
      var img = document.createElement('img');
      img.src = p.t;
      img.alt = p.albumLabel || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      b.appendChild(img);
      b.addEventListener('click', function () { lbOpen(pool, idx); });
      strip.appendChild(b);
    });
    media.appendChild(strip);

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'craft__nav craft__nav--prev';
    prev.innerHTML = ARROW_L;
    prev.setAttribute('aria-label', '往前看');
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'craft__nav craft__nav--next';
    next.innerHTML = ARROW_R;
    next.setAttribute('aria-label', '往后看更多作品');

    function upd() {
      var max = strip.scrollWidth - strip.clientWidth;
      prev.hidden = strip.scrollLeft <= 4;
      next.hidden = strip.scrollLeft >= max - 4;
    }
    var step = function () { return Math.max(160, Math.round(strip.clientWidth * 0.86)); };
    prev.addEventListener('click', function () { strip.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { strip.scrollBy({ left: step(), behavior: 'smooth' }); });
    strip.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);

    /* 鼠标悬停时滚轮横向翻看作品；滑到两端就放行，让页面继续上下滚 */
    strip.addEventListener('wheel', function (e) {
      var max = strip.scrollWidth - strip.clientWidth;
      if (max <= 4) return;
      var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      var target = strip.scrollLeft + d;
      var atStart = strip.scrollLeft <= 0;
      var atEnd = strip.scrollLeft >= max - 1;
      if ((d < 0 && atStart) || (d > 0 && atEnd)) return;   // 到头了 → 页面正常滚动
      e.preventDefault();
      strip.scrollLeft = Math.max(0, Math.min(max, target));
      upd();
    }, { passive: false });
    strip.addEventListener('load', upd, true);     // 图片加载后宽度才算准，重新判断箭头
    if ('ResizeObserver' in window) new ResizeObserver(upd).observe(strip);

    media.appendChild(prev);
    media.appendChild(next);

    var hint = document.createElement('p');
    hint.className = 'craft__hint';
    hint.textContent = pool.length + ' 张精选 · 点开看大图' + (pool.length > 3 ? ' · 滚轮或右侧箭头看更多' : '');
    media.appendChild(hint);

    setTimeout(upd, 80);
  }

  function buildCraft() {
    var list = document.getElementById('craftList');
    var items = (window.AY_CONTENT && window.AY_CONTENT.craft) || [];
    if (!list || !items.length) return;
    var rebuilt = list.children.length > 0;   // 精选配置刷新导致的重建：直接可见，避免错过进场观察器
    var frag = document.createDocumentFragment();

    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'craft__item rv' + (rebuilt ? ' is-in' : '');

      var text = document.createElement('div');
      text.className = 'craft__text';
      var en = document.createElement('p');
      en.className = 'craft__en';
      en.textContent = it.en || '';
      text.appendChild(en);

      var mid = document.createElement('div');
      var h = document.createElement('h3');
      h.className = 'craft__name';
      h.textContent = it.title;
      mid.appendChild(h);
      if (it.tags && it.tags.length) {
        var tw = document.createElement('div');
        tw.className = 'craft__tags';
        it.tags.forEach(function (t) {
          var sp = document.createElement('span');
          sp.textContent = t;
          tw.appendChild(sp);
        });
        mid.appendChild(tw);
      }
      var body = document.createElement('p');
      body.className = 'craft__body';
      body.textContent = it.body || '';
      mid.appendChild(body);
      text.appendChild(mid);
      li.appendChild(text);

      var media = document.createElement('div');
      media.className = 'craft__media';
      var pool = domainPool(domainKeyOf(it.title), 14);
      if (pool.length) {
        buildStrip(media, pool);
      } else {
        var ph = document.createElement('div');
        ph.className = 'craft__empty';
        ph.textContent = '这个方向还没有精选作品\n在后台勾选精选后会自动出现在这里';
        ph.style.whiteSpace = 'pre-line';
        media.appendChild(ph);
      }
      li.appendChild(media);

      frag.appendChild(li);
    });

    list.textContent = '';
    list.appendChild(frag);
    window.AY_REFRESH_CRAFT = function () { buildCraft(); };
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
    loadOverrides();                           // 异步：拉到后台配置后自动重排

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

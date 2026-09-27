// 홍보 영상용 모션그래픽 층. record-promo.py가 모든 페이지에 add_init_script로 심는다.
// 앱 DOM은 건드리지 않고 body 끝에 #pm 한 장을 얹는다. 앱 루트(#app, 자료실은 body>div)는 tilt 때만 transform.
(() => {
  if (window.pm) return;
  const E = 'cubic-bezier(.2,.8,.2,1)';
  const css = `
  #pm{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:'Apple SD Gothic Neo',Pretendard,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
  #pm .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;opacity:0;transition:opacity .6s ${E};
    background:radial-gradient(120% 90% at 20% 10%,#3a1f14 0%,#16100d 45%,#0b0a09 100%)}
  #pm .card::after{content:'';position:absolute;inset:0;opacity:.09;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  #pm .card.on{opacity:1}
  #pm .kt{display:flex;flex-wrap:wrap;justify-content:center;gap:0 .32em;font-weight:800;letter-spacing:-.03em;line-height:1.08;text-align:center;max-width:80vw}
  #pm .kt .w{display:inline-block;overflow:hidden;padding-bottom:.08em}
  #pm .kt .w>span{display:inline-block;transform:translateY(110%);transition:transform .8s ${E}}
  #pm .on .kt .w>span,#pm .kt.on .w>span{transform:none}
  #pm .eyebrow{font-size:22px;letter-spacing:.32em;color:#e8b27a;font-weight:600;opacity:0;transform:translateY(12px);transition:all .7s ${E} .15s}
  #pm .on .eyebrow{opacity:1;transform:none}
  #pm .sub{font-size:30px;color:#d9cfc6;font-weight:500;opacity:0;transition:opacity .8s ${E} .9s;text-align:center;max-width:70vw;line-height:1.5}
  #pm .on .sub{opacity:1}
  #pm .accent{color:#f0a45c}
  #pm .stats{display:flex;gap:90px}
  #pm .stat{text-align:center;opacity:0;transform:translateY(24px);transition:all .8s ${E}}
  #pm .on .stat{opacity:1;transform:none}
  #pm .stat b{display:block;font-size:150px;font-weight:800;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#fff,#f0a45c);-webkit-background-clip:text;color:transparent}
  #pm .stat span{font-size:28px;color:#cbbfb4;font-weight:600}
  #pm .lt{position:absolute;left:64px;bottom:250px;display:flex;align-items:center;gap:18px;padding:18px 30px 18px 22px;border-radius:18px;
    background:rgba(16,12,10,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 20px 60px rgba(0,0,0,.35);
    opacity:0;transform:translateX(-30px);transition:all .6s ${E};max-width:62vw}
  #pm .lt.on{opacity:1;transform:none}
  #pm .lt i{width:6px;align-self:stretch;border-radius:3px;background:#f0a45c}
  #pm .lt .t{font-size:40px;font-weight:800;letter-spacing:-.02em}
  #pm .lt .s{font-size:24px;color:#d6cbc1;margin-top:6px;font-weight:500}
  #pm .chip{position:absolute;right:64px;top:56px;padding:10px 20px;border-radius:999px;background:rgba(240,164,92,.95);color:#1b120c;font-weight:800;font-size:22px;
    opacity:0;transform:scale(.9);transition:all .5s ${E}}
  #pm .chip.on{opacity:1;transform:none}
  #pm .ring{position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:4px solid #f0a45c;box-shadow:0 0 0 9999px rgba(0,0,0,0);
    opacity:0;transition:left .9s ${E},top .9s ${E},opacity .3s,transform .3s,box-shadow .6s}
  #pm .ring.on{opacity:1}
  #pm .ring.spot{box-shadow:0 0 0 9999px rgba(0,0,0,.45)}
  #pm .ring.tap{transform:scale(.7)}
  #pm .bento{display:grid;grid-template-columns:repeat(3,420px);grid-auto-rows:210px;gap:22px}
  #pm .tile{border-radius:26px;padding:30px;background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.12);
    display:flex;flex-direction:column;justify-content:flex-end;opacity:0;transform:translateY(30px) scale(.96);transition:all .7s ${E}}
  #pm .on .tile{opacity:1;transform:none}
  #pm .tile b{font-size:36px;font-weight:800;letter-spacing:-.02em}
  #pm .tile span{font-size:22px;color:#cbbfb4;margin-top:8px;line-height:1.4}
  #pm .tile em{font-style:normal;font-size:20px;color:#f0a45c;font-weight:700;margin-bottom:auto}
  #pm .url{font-size:34px;font-weight:700;color:#fff;background:rgba(255,255,255,.08);padding:14px 28px;border-radius:14px;opacity:0;transition:opacity .8s ${E} 1s}
  #pm .on .url{opacity:1}
  #pm .progress{position:absolute;left:0;bottom:0;height:5px;background:#f0a45c;width:0;transition:width .4s linear}
  [class^='tour-'],[class*=' tour-']{display:none!important}
  html.pm-tilt body{background:radial-gradient(120% 90% at 20% 10%,#3a1f14 0%,#16100d 45%,#0b0a09 100%)!important}
  .pm-root{transition:transform 1.1s ${E},border-radius 1.1s ${E},box-shadow 1.1s ${E};transform-origin:50% 45%}
  html.pm-tilt .pm-root{transform:perspective(2200px) rotateX(7deg) rotateY(-5deg) scale(.84);border-radius:22px;overflow:hidden;box-shadow:0 60px 140px rgba(0,0,0,.6)}
  `;
  const words = (t, size) => `<div class="kt" style="font-size:${size}px">` + t.split(/\s+/).map((w, i) =>
    `<span class="w"><span style="transition-delay:${(i * 0.09).toFixed(2)}s">${w}</span></span>`).join('') + '</div>';
  const mount = () => {
    if (document.getElementById('pm')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'pm';
    d.innerHTML = '<div class="card" id="pm-card"></div><div class="ring" id="pm-ring"></div><div class="lt" id="pm-lt"><i></i><div><div class="t"></div><div class="s"></div></div></div><div class="chip" id="pm-chip"></div><div class="progress" id="pm-prog"></div>';
    document.body.appendChild(d);
    const root = document.getElementById('app') || document.body.firstElementChild; if (root) root.classList.add('pm-root');
  };
  const $ = id => document.getElementById(id);
  const on = (el, v) => el.classList.toggle('on', v);
  window.pm = {
    mount,
    card(html) { mount(); const c = $('pm-card'); on(c, false); c.innerHTML = html; requestAnimationFrame(() => requestAnimationFrame(() => on(c, true))); },
    cardOff() { on($('pm-card'), false); },
    words,
    title(eyebrow, text, sub, size = 110) { this.card(`${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}${words(text, size)}${sub ? `<div class="sub">${sub}</div>` : ''}`); },
    stats(items) {
      this.card(`<div class="stats">${items.map((s, i) => `<div class="stat" style="transition-delay:${i * .15}s"><b data-n="${s.n}">0</b><span>${s.l}</span></div>`).join('')}</div>`);
      const t0 = performance.now();
      const tick = t => { const k = Math.min(1, (t - t0) / 1600), e = 1 - Math.pow(1 - k, 4);
        document.querySelectorAll('#pm .stat b').forEach(b => b.textContent = Math.round(+b.dataset.n * e).toLocaleString('ko-KR'));
        if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    },
    bento(tiles, head) {
      this.card(`${head ? words(head, 72) : ''}<div class="bento">${tiles.map((t, i) => `<div class="tile" style="transition-delay:${.25 + i * .09}s"><em>${t.k}</em><b>${t.t}</b><span>${t.s}</span></div>`).join('')}</div>`);
      requestAnimationFrame(() => document.querySelector('#pm .kt')?.classList.add('on'));
    },
    end(text, urls) { this.card(`${words(text, 120)}${urls.map(u => `<div class="url">${u}</div>`).join('')}`); },
    lower(t, s) { mount(); const l = $('pm-lt'); l.querySelector('.t').textContent = t; l.querySelector('.s').textContent = s || ''; on(l, true); },
    lowerOff() { on($('pm-lt'), false); },
    chip(t) { mount(); const c = $('pm-chip'); c.textContent = t; on(c, !!t); },
    ring(x, y, spot) { mount(); const r = $('pm-ring'); r.style.left = x + 'px'; r.style.top = y + 'px'; on(r, true); r.classList.toggle('spot', !!spot); },
    tap() { const r = $('pm-ring'); r.classList.add('tap'); setTimeout(() => r.classList.remove('tap'), 220); },
    ringOff() { const r = $('pm-ring'); on(r, false); r.classList.remove('spot'); },
    tilt(v) { mount(); document.documentElement.classList.toggle('pm-tilt', v); },
    progress(p) { mount(); $('pm-prog').style.width = (p * 100) + '%'; },
  };
  if (document.readyState !== 'loading') mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

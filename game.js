(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (id) => document.getElementById(id);
  const ui = { intro: $('introCard'), pause: $('pauseCard'), end: $('endCard'), hud: $('gameHud'), score: $('score'), rings: $('rings'), distance: $('distance'), best: $('bestScore'), finalScore: $('finalScore'), finalRings: $('finalRings'), bestNote: $('bestNote'), speed: $('speedLines'), toast: $('toast') };
  const laneX = [-2.3, 0, 2.3];
  const state = { mode: 'menu', lane: 1, laneVisual: 1, jump: 0, jumpV: 0, slide: 0, distance: 0, rings: 0, score: 0, speed: 20, objects: [], spawnTimer: 0, world: 0, time: 0, last: 0, shake: 0, best: Number(localStorage.getItem('sonicNeonBest') || 0), toastTimer: 0, combo: 0, audio: true, audioContext: null };
  let W = 0, H = 0, dpr = 1, focal = 0, horizon = 0, cameraHeight = 2.1;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const formatScore = (n) => Math.floor(n).toString().padStart(6, '0');
  ui.best.textContent = formatScore(state.best);

  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); focal = H * .92; horizon = H * .345;
  }
  window.addEventListener('resize', resize); resize();
  function project(x, y, z) {
    const depth = z + 7.2; const s = focal / Math.max(1, depth);
    return { x: W * .5 + x * s, y: horizon + (cameraHeight - y) * s, s };
  }
  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath(); points.forEach((p, i) => { const q = project(p[0], p[1], p[2]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(a, b, color, width = 1) { const p = project(a[0], a[1], a[2]), q = project(b[0], b[1], b[2]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#081629'); sky.addColorStop(.38, '#134273'); sky.addColorStop(.62, '#f08c62'); sky.addColorStop(.77, '#f7be76'); sky.addColorStop(1, '#34536a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * .52, horizon * .94, 2, W * .52, horizon * .94, H * .30);
    sun.addColorStop(0, '#ffe6ad88'); sun.addColorStop(.22, '#ffb17a35'); sun.addColorStop(1, '#ffaf7600');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H * .7);
    const sunY = horizon * .96; const sunR = Math.min(W, H) * .075;
    ctx.save(); ctx.globalAlpha = .8; ctx.fillStyle = '#ffe8b4'; ctx.shadowColor = '#ffc884'; ctx.shadowBlur = 38;
    ctx.beginPath(); ctx.arc(W * .52, sunY, sunR, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // Distant hills
    ctx.fillStyle = '#1c5872'; ctx.beginPath(); ctx.moveTo(0, horizon * 1.24);
    for (let x = 0; x <= W + 50; x += 50) ctx.lineTo(x, horizon * (1.12 + .12 * Math.sin(x * .011 + 2) + .045 * Math.sin(x * .027)));
    ctx.lineTo(W, horizon * 1.4); ctx.lineTo(0, horizon * 1.4); ctx.fill();
    ctx.fillStyle = '#214b61'; ctx.beginPath(); ctx.moveTo(0, horizon * 1.31);
    for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, horizon * (1.22 + .06 * Math.sin(x * .014 + 1) + .035 * Math.cos(x * .027)));
    ctx.lineTo(W, horizon * 1.48); ctx.lineTo(0, horizon * 1.48); ctx.fill();
    // Skyline silhouettes
    const scroll = (state.world * 3) % 120;
    for (let i = -1; i < Math.ceil(W / 105) + 1; i++) {
      const x = i * 105 - scroll, seed = Math.abs(i * 83 + 17) % 10, bw = 45 + seed * 5, bh = 35 + (seed * 29 % 80);
      const y = horizon * 1.34 - bh; ctx.fillStyle = seed % 2 ? '#18394e' : '#1a4357';
      ctx.fillRect(x, y, bw, bh + horizon * .25);
      ctx.fillStyle = '#a4def036';
      for (let wx = x + 8; wx < x + bw - 5; wx += 13) for (let wy = y + 9; wy < horizon * 1.45; wy += 16) if (((wx + wy + seed) | 0) % 3) ctx.fillRect(wx, wy, 4, 6);
    }
    // Floating dust / distant lights
    for (let i = 0; i < 36; i++) {
      const x = (i * 197 + 31) % W, y = horizon * (.18 + ((i * 43) % 100) / 160);
      ctx.globalAlpha = .15 + .22 * Math.sin(state.time * .8 + i); ctx.fillStyle = i % 4 ? '#bceaff' : '#ffe59a'; ctx.fillRect(x, y, i % 4 ? 1.2 : 2, i % 4 ? 1.2 : 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawTrack() {
    polygon([[-4.3, 0, 100], [4.3, 0, 100], [4.3, 0, -3], [-4.3, 0, -3]], '#192a3a');
    // track shoulders
    polygon([[-7.3, 0, 100], [-4.3, 0, 100], [-4.3, 0, -3], [-7.3, 0, -3]], '#34424a');
    polygon([[4.3, 0, 100], [7.3, 0, 100], [7.3, 0, -3], [4.3, 0, -3]], '#34424a');
    // track inset strips
    polygon([[-4.28, .012, 100], [4.28, .012, 100], [4.28, .012, -3], [-4.28, .012, -3]], '#273747');
    // repeating sleepers
    const offset = (state.world * 1.2) % 4.2;
    for (let z = -2 + offset; z < 94; z += 4.2) {
      const end = z + .34; polygon([[-4.12, .035, z], [4.12, .035, z], [4.12, .035, end], [-4.12, .035, end]], z % 2 > 1 ? '#607077' : '#53636a');
      polygon([[-4.08, .045, z], [-3.88, .045, z], [-3.88, .045, end], [-4.08, .045, end]], '#8a9996');
      polygon([[3.88, .045, z], [4.08, .045, z], [4.08, .045, end], [3.88, .045, end]], '#8a9996');
    }
    // central ballast lane and luminous guide strips
    polygon([[-1.02, .055, 100], [1.02, .055, 100], [1.02, .055, -3], [-1.02, .055, -3]], '#1a2631');
    for (const x of [-1.14, 1.14]) {
      line([x, .07, 100], [x, .07, -3], '#1ac9ec8a', Math.max(.8, focal / 550));
      line([x + (x < 0 ? -.035 : .035), .07, 100], [x + (x < 0 ? -.035 : .035), .07, -3], '#94f5ff48', Math.max(.4, focal / 1050));
    }
    // steel rails with glints
    for (const x of [-3.15, 3.15]) {
      polygon([[x - .12, .05, 100], [x + .12, .05, 100], [x + .12, .27, -3], [x - .12, .27, -3]], '#81949b');
      line([x - .12, .25, 100], [x - .12, .25, -3], '#d4e5e3', Math.max(1, focal / 480));
      line([x + .12, .2, 100], [x + .12, .2, -3], '#384c59', Math.max(1, focal / 520));
    }
    // side walkway markings
    for (let side of [-1, 1]) for (let z = -2 + offset; z < 90; z += 8.4) {
      polygon([[side * 4.6, .04, z], [side * 4.74, .04, z], [side * 4.74, .04, z + 1.1], [side * 4.6, .04, z + 1.1]], '#d29d58');
    }
    // luminous side edge
    line([-4.35, .08, 100], [-4.35, .08, -3], '#ffb66d99', Math.max(.6, focal / 650));
    line([4.35, .08, 100], [4.35, .08, -3], '#ffb66d99', Math.max(.6, focal / 650));
  }
  function drawBuildings() {
    const base = (state.world * .65) % 17;
    for (let side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const z = 9 + i * 15 - base; if (z < -3) continue;
      const seed = i * 17 + (side < 0 ? 8 : 31), h = 4 + seed % 6, w = 3.4 + seed % 3;
      const x = side * (8.5 + (seed % 2) * 1.4);
      const a = project(x - w / 2, 0, z), b = project(x + w / 2, h, z + 1);
      if (a.x < -160 || a.x > W + 160) continue;
      const g = ctx.createLinearGradient(a.x, b.y, a.x + b.x - a.x, a.y); g.addColorStop(0, '#183a50'); g.addColorStop(1, '#25495b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(project(x-w/2,0,z).x,project(x-w/2,0,z).y); ctx.lineTo(project(x-w/2,h,z).x,project(x-w/2,h,z).y); ctx.lineTo(project(x+w/2,h,z).x,project(x+w/2,h,z).y); ctx.lineTo(project(x+w/2,0,z).x,project(x+w/2,0,z).y); ctx.closePath(); ctx.fill();
      if (i % 3 === 1 && z > 7) {
        const p = project(x, h + .55, z); const s = Math.max(.5, p.s * .12);
        ctx.save(); ctx.globalAlpha = clamp(z / 17, .15, .95); ctx.strokeStyle = side < 0 ? '#3feaff' : '#ffbd67'; ctx.lineWidth = 2;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10; ctx.strokeRect(p.x - 12*s, p.y - 5*s, 24*s, 10*s); ctx.restore();
      }
    }
    const gz = 23 + ((state.world * .9) % 38);
    for (const x of [-7.8, 7.8]) polygon([[x-.12,0,gz], [x+.12,0,gz], [x+.12,4.7,gz+.12], [x-.12,4.7,gz+.12]], '#51636c');
    polygon([[-7.95,4.65,gz], [7.95,4.65,gz], [7.95,4.35,gz+.18], [-7.95,4.35,gz+.18]], '#455a65');
    const sign = project(0, 4.15, gz); const signScale = sign.s;
    if (signScale > 3) {
      ctx.save(); ctx.fillStyle = '#071d35'; ctx.strokeStyle = '#59dfff'; ctx.lineWidth = Math.max(1, signScale * .035); ctx.fillRect(sign.x - 1.5*signScale, sign.y, 3*signScale, .62*signScale); ctx.strokeRect(sign.x - 1.5*signScale, sign.y, 3*signScale, .62*signScale);
      ctx.fillStyle = '#8cecff'; ctx.font = `900 ${Math.max(7, signScale*.28)}px 'Barlow Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.fillText('GREEN HILL  →', sign.x, sign.y + .41*signScale); ctx.restore();
    }
  }

  function drawBox(cx, z, width, height, depth, color, accent = '#fff') {
    const za = z - depth/2, zb = z + depth/2, xa = cx - width/2, xb = cx + width/2;
    const face = [[xa,0,za],[xb,0,za],[xb,height,za],[xa,height,za]];
    const side = [[xb,0,za],[xb,0,zb],[xb,height,zb],[xb,height,za]];
    const top = [[xa,height,za],[xb,height,za],[xb,height,zb],[xa,height,zb]];
    polygon(side, '#13253a'); polygon(face, color); polygon(top, color);
    line([xa,.03,za],[xb,.03,za],accent,Math.max(1.3,project(cx,0,z).s*.025));
    line([xa,height-.05,za],[xb,height-.05,za],accent,Math.max(1,project(cx,0,z).s*.017));
    line([xa,0,za],[xa,height,za],'#ffffff75',Math.max(1,project(cx,0,z).s*.018));
    const c=project(cx, height*.52, za-.005); const ss=c.s;
    if (ss>7) {
      ctx.save(); ctx.translate(c.x,c.y); ctx.scale(ss,ss); ctx.strokeStyle=accent; ctx.lineWidth=.035; ctx.globalAlpha=.75;
      if (height>1.3) { ctx.beginPath();ctx.moveTo(-.25,-.2);ctx.lineTo(0,.22);ctx.lineTo(.25,-.2);ctx.stroke(); }
      else { ctx.beginPath();ctx.moveTo(-.27,-.18);ctx.lineTo(.27,.18);ctx.moveTo(.27,-.18);ctx.lineTo(-.27,.18);ctx.stroke(); }
      ctx.restore();
    }
  }
  function drawCoin(o) {
    const p = project(laneX[o.lane], .92 + Math.sin(state.time*5+o.z)*.035, o.z); const r = p.s*.34;
    if (r<1) return;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(Math.sin(state.time*4+o.phase)*.22); ctx.scale(Math.abs(Math.cos(state.time*5+o.phase))*.7+.25,1);
    ctx.shadowColor='#ffd34d';ctx.shadowBlur=r*.9;ctx.lineWidth=Math.max(2,r*.18);ctx.strokeStyle='#ffae22';ctx.beginPath();ctx.ellipse(0,0,r*.78,r,0,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,r*.07);ctx.strokeStyle='#fff0a5';ctx.beginPath();ctx.ellipse(0,0,r*.48,r*.73,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  function drawObject(o) {
    const x=laneX[o.lane], z=o.z;
    if(o.type==='ring'){drawCoin(o);return;}
    const p=project(x,0,z); if(p.s<1.6)return;
    // cast shadow
    ctx.save();ctx.globalAlpha=.24;ctx.fillStyle='#07101a';ctx.beginPath();ctx.ellipse(p.x,p.y,p.s*.8,p.s*.14,0,0,Math.PI*2);ctx.fill();ctx.restore();
    if(o.type==='crate'){
      drawBox(x,z,1.35,1.24,1.15,'#d66a36','#ffd081');
      const q=project(x,1.22,z-.58),s=q.s;ctx.save();ctx.translate(q.x,q.y);ctx.scale(s,s);ctx.fillStyle='#823e35';ctx.beginPath();ctx.moveTo(-.3,-.25);ctx.lineTo(0,.27);ctx.lineTo(.3,-.25);ctx.closePath();ctx.fill();ctx.restore();
    } else if(o.type==='hurdle'){
      drawBox(x,z,1.72,.62,.48,'#ed4e54','#ffcf69');
      const q=project(x,.31,z-.27),s=q.s;ctx.save();ctx.translate(q.x,q.y);ctx.scale(s,s);ctx.strokeStyle='#ffdf8a';ctx.lineWidth=.1;ctx.beginPath();ctx.moveTo(-.68,-.22);ctx.lineTo(-.35,.22);ctx.moveTo(-.2,-.22);ctx.lineTo(.13,.22);ctx.moveTo(.28,-.22);ctx.lineTo(.6,.22);ctx.stroke();ctx.restore();
    } else if(o.type==='beam'){
      // side-mounted striped posts and a low overhead beam: slide underneath
      drawBox(x- .73,z,.17,1.68,.22,'#1bb8ca','#b3f5ff');drawBox(x+.73,z,.17,1.68,.22,'#1bb8ca','#b3f5ff');
      drawBox(x,z,1.7,.42,.3,'#ea5360','#ffdb78');
      const q=project(x,1.47,z-.17),s=q.s;if(s>4){ctx.save();ctx.translate(q.x,q.y);ctx.scale(s,s);ctx.strokeStyle='#fff0bb';ctx.lineWidth=.07;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*.24,-.19);ctx.lineTo(i*.24+.2,.19);ctx.stroke();}ctx.restore();}
    } else if(o.type==='train'){
      drawBox(x,z,2.1,2.15,3.8,'#2c7dc2','#73eaff');
      const q=project(x,1.22,z-1.94),s=q.s;ctx.save();ctx.translate(q.x,q.y);ctx.scale(s,s);ctx.fillStyle='#08253e';ctx.strokeStyle='#65d8ff';ctx.lineWidth=.045;
      for(let i=-1;i<=1;i++){ctx.fillRect(i*.58-.22,-.25,.44,.49);ctx.strokeRect(i*.58-.22,-.25,.44,.49);}ctx.restore();
    }
  }

  function drawSonic() {
    const lanePos=laneX[state.laneVisual] + (state.mode==='menu'?-.25:0);
    const base=project(lanePos,0,0), scale=base.s;
    const jumpY=Math.sin(state.jump*Math.PI)*1.3;
    const bob=(state.mode==='running'&&!state.slide)?Math.sin(state.time*15)*.055:Math.sin(state.time*2)*.025;
    const groundY=base.y-jumpY*scale;
    // speed shadow
    ctx.save();ctx.globalAlpha=.24;ctx.fillStyle='#080e18';ctx.beginPath();ctx.ellipse(base.x,base.y,scale*.64,scale*.12,0,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.translate(base.x,groundY);ctx.scale(scale,-scale);
    const lean=(state.laneVisual-state.lane)*.08;
    ctx.rotate(lean + (state.mode==='running'?Math.sin(state.time*15)*.025:0));
    if(state.slide>0){ctx.translate(.12,-.1);ctx.rotate(-.27);}
    ctx.translate(0,bob);
    // quills silhouette behind head
    ctx.fillStyle='#0750bb';ctx.strokeStyle='#062e80';ctx.lineWidth=.035;
    ctx.beginPath();ctx.moveTo(-.36,1.31);ctx.lineTo(-.96,1.68);ctx.lineTo(-.77,1.13);ctx.lineTo(-1.05,.79);ctx.lineTo(-.52,.88);ctx.lineTo(-.38,.55);ctx.lineTo(.15,.83);ctx.lineTo(.34,1.45);ctx.closePath();ctx.fill();ctx.stroke();
    // back leg and shoe
    ctx.fillStyle='#0756cf';ctx.beginPath();ctx.ellipse(-.23,.32,.2,.39,-.22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d92b39';ctx.beginPath();ctx.moveTo(-.47,.15);ctx.quadraticCurveTo(-.79,.05,-.77,.25);ctx.lineTo(-.59,.42);ctx.lineTo(-.24,.39);ctx.lineTo(-.2,.19);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';ctx.fillRect(-.63,.24,.34,.07);ctx.fillStyle='#dbbba0';ctx.beginPath();ctx.ellipse(-.52,.12,.27,.055,0,0,Math.PI*2);ctx.fill();
    // torso, belly
    ctx.fillStyle='#0874ee';ctx.beginPath();ctx.ellipse(.03,.78,.31,.48,-.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f2c8a0';ctx.beginPath();ctx.ellipse(.17,.72,.19,.27,.13,0,Math.PI*2);ctx.fill();
    // near arm and glove
    ctx.fillStyle='#0870e7';ctx.beginPath();ctx.moveTo(-.15,.96);ctx.quadraticCurveTo(-.48,.85,-.54,.56);ctx.lineTo(-.43,.44);ctx.lineTo(-.23,.57);ctx.lineTo(.02,.81);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f7f8fb';ctx.beginPath();ctx.ellipse(-.52,.47,.16,.14,-.3,0,Math.PI*2);ctx.fill();
    // face / head
    ctx.fillStyle='#086ff0';ctx.beginPath();ctx.ellipse(.05,1.26,.43,.48,.06,0,Math.PI*2);ctx.fill();
    // face patch and muzzle
    ctx.fillStyle='#f3c9a1';ctx.beginPath();ctx.ellipse(.34,1.04,.3,.2,-.05,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e7b891';ctx.beginPath();ctx.ellipse(.52,1.095,.11,.075,0,0,Math.PI*2);ctx.fill();
    // ears
    ctx.fillStyle='#0870e8';ctx.beginPath();ctx.moveTo(-.22,1.53);ctx.lineTo(-.32,1.84);ctx.lineTo(-.02,1.61);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(.28,1.55);ctx.lineTo(.43,1.8);ctx.lineTo(.48,1.49);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e9b798';ctx.beginPath();ctx.moveTo(-.2,1.57);ctx.lineTo(-.25,1.72);ctx.lineTo(-.08,1.59);ctx.closePath();ctx.fill();
    // eyes, brows
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(.22,1.34,.16,.25,-.12,0,Math.PI*2);ctx.ellipse(.39,1.32,.12,.2,.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#128cd5';ctx.beginPath();ctx.ellipse(.27,1.31,.064,.13,0,0,Math.PI*2);ctx.ellipse(.42,1.3,.05,.11,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111f38';ctx.beginPath();ctx.ellipse(.29,1.32,.029,.08,0,0,Math.PI*2);ctx.ellipse(.43,1.31,.025,.07,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#0646aa';ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(.12,1.56);ctx.quadraticCurveTo(.29,1.62,.45,1.54);ctx.stroke();
    // smile
    ctx.strokeStyle='#754b43';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(.31,.98);ctx.quadraticCurveTo(.44,.94,.52,.99);ctx.stroke();
    // front leg and iconic red shoe
    const run=Math.sin(state.time*15)*.16*(state.mode==='running'&&!state.slide?1:0);
    ctx.fillStyle='#0873eb';ctx.beginPath();ctx.ellipse(.24,.34,.16,.32,run,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e52d3b';ctx.beginPath();ctx.moveTo(.08,.13);ctx.quadraticCurveTo(.17,.03,.43,.08);ctx.quadraticCurveTo(.75,.1,.76,.25);ctx.quadraticCurveTo(.73,.38,.44,.36);ctx.lineTo(.1,.32);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f8fbff';ctx.beginPath();ctx.moveTo(.22,.25);ctx.lineTo(.63,.25);ctx.lineTo(.62,.31);ctx.lineTo(.2,.31);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f1c39f';ctx.beginPath();ctx.ellipse(.43,.075,.34,.065,0,0,Math.PI*2);ctx.fill();
    // wrist cuff highlight
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(-.52,.57,.17,.055,-.5,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  function addRings(lane, startZ, count = 5, gap = 2.3) {
    for (let i=0;i<count;i++) state.objects.push({type:'ring',lane,z:startZ+i*gap,phase:rand(0,6.2),taken:false});
  }
  function spawnPattern(z=74) {
    const lane=Math.floor(Math.random()*3), roll=Math.random();
    if(roll<.34){ addRings(lane,z,6,2.25); if(Math.random()<.25) addRings((lane+1)%3,z+5,4,2.5); return; }
    const types=['crate','hurdle','beam'];
    const type=roll>.93?'train':types[Math.floor(Math.random()*types.length)];
    state.objects.push({type,lane,z,phase:0});
    if(Math.random()<.52) addRings((lane+1+Math.floor(Math.random()*2))%3,z+4,4,2.5);
    else if(Math.random()<.45) addRings(lane,z+7,3,2.6);
  }
  function initializeMenuScene(){
    state.objects=[]; addRings(0,18,6,3); addRings(2,27,5,3.2); addRings(1,48,7,3);
    state.objects.push({type:'hurdle',lane:2,z:63}); state.objects.push({type:'crate',lane:0,z:76});
  }
  function playTone(freq=750,duration=.11){
    if(!state.audio)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return; state.audioContext ||= new AC(); if(state.audioContext.state==='suspended')state.audioContext.resume();
      const o=state.audioContext.createOscillator(),g=state.audioContext.createGain();
      o.type='sine';o.frequency.setValueAtTime(freq,state.audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.45,state.audioContext.currentTime+duration);
      g.gain.setValueAtTime(.055,state.audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,state.audioContext.currentTime+duration);
      o.connect(g);g.connect(state.audioContext.destination);o.start();o.stop(state.audioContext.currentTime+duration);
    }catch(_){/* audio is optional */}
  }
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.remove('hidden');state.toastTimer=1.05;}
  function updateHud(){ui.score.textContent=formatScore(state.score);ui.rings.textContent=state.rings;ui.distance.textContent=Math.floor(state.distance);}
  function startGame(){
    state.mode='running';state.lane=1;state.laneVisual=1;state.jump=0;state.jumpV=0;state.slide=0;state.distance=0;state.rings=0;state.score=0;state.speed=20;state.objects=[];state.spawnTimer=.75;state.combo=0;state.shake=0;
    spawnPattern(49);spawnPattern(83);ui.intro.classList.add('hidden');ui.end.classList.add('hidden');ui.pause.classList.add('hidden');ui.hud.classList.add('active');ui.speed.classList.add('active');$('pauseButton').style.visibility='visible';updateHud();
  }
  function finishGame(){
    if(state.mode!=='running')return;state.mode='over';state.shake=.45;playTone(170,.35);
    state.score=Math.floor(state.distance*10+state.rings*25);const isBest=state.score>state.best;
    if(isBest){state.best=state.score;localStorage.setItem('sonicNeonBest',state.best);ui.best.textContent=formatScore(state.best);}
    ui.finalScore.textContent=formatScore(state.score);ui.finalRings.textContent=state.rings;ui.bestNote.textContent=isBest?'✦  NEW PERSONAL BEST!':'KEEP AT IT, BLUE BLUR';
    ui.end.classList.remove('hidden');ui.hud.classList.remove('active');ui.speed.classList.remove('active');$('pauseButton').style.visibility='hidden';
  }
  function pauseGame(){if(state.mode!=='running')return;state.mode='paused';ui.pause.classList.remove('hidden');ui.speed.classList.remove('active');}
  function resumeGame(){if(state.mode!=='paused')return;state.mode='running';ui.pause.classList.add('hidden');ui.speed.classList.add('active');state.last=performance.now();}
  function moveLane(dir){if(state.mode!=='running')return;state.lane=clamp(state.lane+dir,0,2);}
  function jump(){if(state.mode!=='running'||state.jump>0||state.slide>0)return;state.jump=0.001;state.jumpV=2.8;playTone(420,.07);}
  function slide(){if(state.mode!=='running'||state.jump>.05)return;state.slide=.72;}
  function action(name){if(name==='left')moveLane(-1);else if(name==='right')moveLane(1);else if(name==='jump')jump();else if(name==='slide')slide();}
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' ','a','d','w','s'].includes(key))e.preventDefault();
    if(key==='escape'||key==='p'){state.mode==='running'?pauseGame():state.mode==='paused'?resumeGame():null;return;}
    if(key==='arrowleft'||key==='a')action('left');if(key==='arrowright'||key==='d')action('right');if(key==='arrowup'||key==='w'||key===' ')action('jump');if(key==='arrowdown'||key==='s')action('slide');
  });
  document.querySelectorAll('.touch-controls button').forEach(button=>button.addEventListener('pointerdown',e=>{e.preventDefault();action(button.dataset.action);}));
  let touchStart=null;
  canvas.addEventListener('pointerdown',e=>{touchStart={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',e=>{
    if(!touchStart||state.mode!=='running')return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;if(Math.abs(dx)>Math.abs(dy))action(dx<0?'left':'right');else action(dy<0?'jump':'slide');
  });
  $('playButton').addEventListener('click',startGame);$('retryButton').addEventListener('click',startGame);$('resumeButton').addEventListener('click',resumeGame);$('pauseButton').addEventListener('click',pauseGame);$('pauseRestart').addEventListener('click',startGame);
  $('brandHome').addEventListener('click',e=>{e.preventDefault();if(state.mode==='running')pauseGame();else if(state.mode==='paused')resumeGame();else startGame();});
  $('soundButton').addEventListener('click',()=>{state.audio=!state.audio;$('soundIcon').textContent=state.audio?'♫':'×';$('soundButton').setAttribute('aria-label',state.audio?'Mute sound':'Enable sound');if(state.audio)playTone();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
  window.addEventListener('blur',()=>pauseGame());

  function update(dt){
    state.time+=dt;state.laneVisual+=(state.lane-state.laneVisual)*Math.min(1,dt*12);
    if(state.mode==='menu'){
      state.world+=dt*4.3;for(const o of state.objects)o.z-=dt*4.3;
      state.objects=state.objects.filter(o=>o.z>-8);if(state.objects.length<10)initializeMenuScene();
      return;
    }
    if(state.mode!=='running')return;
    state.speed=Math.min(31,20+state.distance*.012);const move=state.speed*dt;
    state.distance+=move;state.world+=move;state.score=Math.floor(state.distance*10+state.rings*25);
    state.spawnTimer-=dt;if(state.spawnTimer<=0){spawnPattern(76);state.spawnTimer=Math.max(.87,1.3-(state.speed-20)*.021);}
    if(state.jump>0){state.jump+=state.jumpV*dt;state.jumpV-=7.4*dt;if(state.jump>=1){state.jump=1;state.jumpV=-2.8;}if(state.jump<0){state.jump=0;state.jumpV=0;}}
    if(state.slide>0)state.slide=Math.max(0,state.slide-dt);
    for(const o of state.objects){
      o.z-=move;if(o.type==='ring'&&!o.taken&&Math.abs(o.z)<.72&&o.lane===state.lane){o.taken=true;state.rings++;state.combo++;playTone(700+Math.min(400,state.combo*14),.09);if(state.combo===5||state.combo===10)showToast(state.combo+' RING STREAK!');}
      if(o.type!=='ring'&&!o.hit&&o.z<1.35&&o.z>-.7&&o.lane===state.lane){
        const clear=(o.type==='hurdle'&&state.jump>.40)||(o.type==='beam'&&state.slide>.08);
        if(!clear){o.hit=true;finishGame();break;}else{o.hit=true;state.combo=0;}
      }
      if(o.type!=='ring'&&o.z<-2&&o.lane!==state.lane)state.combo=0;
    }
    state.objects=state.objects.filter(o=>o.z>-5&&!(o.type==='ring'&&o.taken));
    state.shake=Math.max(0,state.shake-dt);if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.add('hidden');}
    if(Math.random()<dt*.12)state.combo=0;
    updateHud();
  }

  function draw(){
    const shake=state.shake>0?(Math.random()-.5)*state.shake*18:0;
    ctx.save();ctx.translate(shake,0);drawSky();drawBuildings();drawTrack();
    const visible=state.objects.filter(o=>o.z<105&&o.z>-4).sort((a,b)=>b.z-a.z);
    for(const o of visible)drawObject(o);
    drawSonic();ctx.restore();
    // soft cyan horizon bloom
    const glow=ctx.createRadialGradient(W*.5,horizon*1.52,1,W*.5,horizon*1.52,H*.65);
    glow.addColorStop(0,'#ffb56a12');glow.addColorStop(1,'#ffb56a00');ctx.fillStyle=glow;ctx.fillRect(0,horizon,H>W?W:W,H-horizon);
  }
  function loop(now){
    const dt=Math.min(.045,(now-(state.last||now))/1000);state.last=now;
    update(dt);draw();requestAnimationFrame(loop);
  }
  initializeMenuScene();requestAnimationFrame(loop);
})();

import './style.css';
import * as THREE from 'three';
import { LANES, GRAVITY, JUMP_SPEED, speedAt, scoreFor, isOnRoof, hitsObstacle, safeStored, safeSave } from './game-logic.js';

const $ = id => document.getElementById(id);
const game = $('game');
let storage; try { storage = window.localStorage; } catch { storage = null; }
let best = Number(safeStored(storage, 'skyline-best', '0')) || 0;
let colour = safeStored(storage, 'skyline-colour', '#d5f67b');
if (!/^#[0-9a-f]{6}$/i.test(colour)) colour = '#d5f67b';
let mode = 'menu', distance = 0, shards = 0, lane = 1, y = 0, vy = 0, elapsed = 0;
let coyote = 0, jumpBuffer = 0, falling = false, lastTime = 0, wasRunningBeforeHelp = false;
let nextRoofEdge = 20, roofIndex = 0, audio, soundOn = false, runSeed = 0;
const segments = [], obstacles = [], coins = [], particles = [], city = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let randomState = 431;
function random() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; }
const materialCache = new Map();
function mat(color, roughness = .85) {
  const key = `${color}:${roughness}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }));
  return materialCache.get(key);
}
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e5e6d0');
scene.fog = new THREE.Fog('#e5e6d0', 55, 190);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  $('world').appendChild(renderer.domElement);
} catch {
  $('loading').hidden = true; $('webgl-error').hidden = false; throw new Error('WebGL is unavailable.');
}
const camera = new THREE.PerspectiveCamera(39, 1, .1, 300);
scene.add(new THREE.HemisphereLight('#ffefd5', '#547f73', 2.4));
const sun = new THREE.DirectionalLight('#ffe0af', 3.1);
sun.position.set(-28, 45, -14); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 130;
sun.shadow.normalBias = .035; scene.add(sun);
const world = new THREE.Group(); scene.add(world);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
function box(parent, width, height, depth, color, x = 0, y = 0, z = 0, cast = true) {
  const mesh = new THREE.Mesh(unitBox, typeof color === 'string' ? mat(color) : color);
  mesh.scale.set(width, height, depth); mesh.position.set(x, y, z);
  mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function instancedBoxes(parent, specs, color) {
  if(!specs.length)return;
  const mesh=new THREE.InstancedMesh(unitBox,mat(color),specs.length);
  const dummy=new THREE.Object3D();
  specs.forEach(([w,h,d,x,y,z],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);
}
const floor = box(scene, 700, 1, 700, '#cbd7bd', 0, -27, -80, false);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 24), new THREE.MeshBasicMaterial({color:'#f5c88b',fog:false}));
sunDisc.position.set(-35, 16, -125); scene.add(sunDisc);
const halo = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 24), new THREE.MeshBasicMaterial({color:'#f4d49f',transparent:true,opacity:.25,depthWrite:false,fog:false}));
halo.position.copy(sunDisc.position); scene.add(halo);
// A softly layered, original low-poly city. All geometry is generated locally.
const cityColours = ['#85aa9b','#acc0a2','#c5c9aa','#b8bfa1','#7ca497','#d4c5a5','#a0baa0'];
function building(x, z, height, width, depth, color) {
  const g = new THREE.Group(); g.position.set(x, -26, z); scene.add(g);
  box(g, width, height, depth, color, 0, height/2, 0);
  box(g, width+.5, .5, depth+.5, '#d1d6b4', 0, height+.1, 0);
  if (height > 14) box(g, width*.6, 1.2, depth*.55, color, 0, height+.9, 0);
  const darkWindows=[],litWindows=[],sideWindows=[];
  for (let row=2;row<height-2;row+=3.1) {
    for (let col=-width/2+1.1;col<width/2-.5;col+=1.8) {
      (random()>.65?litWindows:darkWindows).push([.65,1.1,.04,col,row,depth/2+.03]);
    }
    for (let col=-depth/2+1;col<depth/2-.5;col+=2)sideWindows.push([.04,1.1,.7,width/2+.03,row,col]);
  }
  instancedBoxes(g,darkWindows,'#416e67');instancedBoxes(g,litWindows,'#e7dba9');instancedBoxes(g,sideWindows,'#648d7d');
  city.push({group:g, initialZ:z, startZ:z}); return g;
}
for(let i=0;i<58;i++) {
  const side = i%2===0 ? -1:1;
  const x=side*(16+random()*65),z=25-random()*220;
  building(x,z,8+random()*30,4+random()*7,5+random()*8,cityColours[Math.floor(random()*cityColours.length)]);
}
// Distant, graphic clouds.
for(let i=0;i<9;i++){
 const g=new THREE.Group(); const cloudMat=mat('#eeeccf');
 for(let j=0;j<3;j++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),cloudMat);m.scale.set(4+j,1.2,2.2);m.position.set(j*3, j===1?.5:0,0);g.add(m);}
 g.position.set(-80+random()*140,12+random()*20,-80-random()*90);scene.add(g);
}
const jersey = new THREE.MeshStandardMaterial({color:colour,roughness:.8,flatShading:true});
const player = new THREE.Group();scene.add(player);
const body = new THREE.Group(); player.add(body);
box(body, .85, .95, .54, jersey,0,1.36,0);
box(body, .58,.67,.16,'#335c52',0,1.34,.35); // backpack
box(body, .13,.7,.09,jersey,-.21,1.38,.45);
box(body, .13,.7,.09,jersey,.21,1.38,.45);
box(body,.61,.61,.58,'#bf8964',0,2.14,-.02);
box(body,.68,.22,.65,'#193e38',0,2.46,-.01);
box(body,.68,.09,.32,'#193e38',0,2.37,-.39);
box(body,.5,.15,.035,'#244f48',0,2.17,-.325);
box(body,.08,.09,.05,'#fff0cb',-.14,2.18,-.35);
box(body,.08,.09,.05,'#fff0cb',.14,2.18,-.35);
const arms=[],legs=[];
for(const side of [-1,1]){
 const a=new THREE.Group();a.position.set(side*.57,1.72,0);body.add(a);
 box(a,.28,.56,.3,jersey,0,-.23,0);box(a,.25,.3,.27,'#bf8964',0,-.6,0);arms.push(a);
 const l=new THREE.Group();l.position.set(side*.24,.95,0);body.add(l);
 box(l,.32,.66,.35,'#244d44',0,-.3,0);box(l,.37,.2,.59,'#f2edcf',0,-.76,-.1);box(l,.39,.08,.6,'#193e38',0,-.87,-.1);legs.push(l);
}
const shadow = new THREE.Mesh(new THREE.CircleGeometry(.8,24),new THREE.MeshBasicMaterial({color:'#244c3c',transparent:true,opacity:.2,depthWrite:false}));
shadow.rotation.x=-Math.PI/2;shadow.position.y=.04;scene.add(shadow);
const shrubGeometry=new THREE.IcosahedronGeometry(.95,0);
const ringGeometry=new THREE.TorusGeometry(.52,.018,5,20);
const roofColors=['#779e8b','#7ea18b','#7eaa95','#719a88'];
function addRoof() {
  const index=roofIndex++, length=index===0?40:index<3?24:20;
  const z=nextRoofEdge-length/2;
  const gap=index<2?0:3.4;
  nextRoofEdge=z-length/2-gap;
  const g=new THREE.Group();g.position.z=z;world.add(g);
  const height=16+random()*6;
  const wall=index%3===0?'#bb9f7d':index%3===1?'#c7b897':'#9cb09a';
  box(g,11.9,height,length,wall,0,-height/2-.25,0);
  box(g,12.3,.45,length+.15,'#d3d1af',0,-.23,0);
  box(g,11.8,.12,length-.25,roofColors[index%4],0,.02,0);
  // Low parapets frame the three running lanes without obstructing them.
  box(g,.24,.48,length,'#ccceb0',-6,.2,0);box(g,.24,.48,length,'#ccceb0',6,.2,0);
  for(const x of [-1.575,1.575]) for(let j=-length/2+1.5;j<length/2;j+=3) box(g,.06,.018,1.25,'#c7d1a8',x,.095,j,false);
  for(const edge of [-1,1]){
   box(g,11.5,.025,.12,'#e8d88c',0,.1,edge*(length/2-.4),false);
   for(let x=-5;x<=5;x+=.8)box(g,.35,.028,.35,'#a6ab78',x,.11,edge*(length/2-.7),false);
  }
  // Facade details make the track read as rooftops rather than a floating road.
  const facadeWindows=[];
  for(let zz=-length/2+2;zz<length/2-1;zz+=3.4){
   for(let yy=-3;yy>-height+2;yy-=3)facadeWindows.push([.025,1,1.3,6.0,yy,zz]);
  }
  instancedBoxes(g,facadeWindows,'#66897d');
  if(index%2===0){
   box(g,.75,1.6,.75,'#546f5b',-5.2,.9,length/2-3);const shrub=new THREE.Mesh(shrubGeometry,mat('#638468'));shrub.position.set(-5.2,2,length/2-3);g.add(shrub);
  }
  const roof={group:g,z,length};segments.push(roof);
  if(index>0){
   const count=index>5&&random()>.5?2:1, blocked=[];
   for(let j=0;j<count;j++){
    let laneIndex=Math.floor(random()*3);while(blocked.includes(laneIndex))laneIndex=(laneIndex+1)%3;blocked.push(laneIndex);
    const x=LANES[laneIndex],localZ=index===1?0:2;
    const vent=box(g,1.6,1.2,1.6,'#c57e58',x,.65,localZ);
    box(g,1.82,.12,1.8,'#dfba85',x,1.3,localZ);
    for(let k=0;k<4;k++)box(g,1.25,.05,.13,'#835c44',x,1.38,localZ-.5+k*.3,false);
    obstacles.push({roof,x,z:z+localZ,height:1.35,mesh:vent});
   }
   const coinLane=LANES[[0,1,2].find(l=>!blocked.includes(l))];
   for(let zz=length/2-2;zz>-length/2+2;zz-=3.1)addCoin(g,roof,coinLane,1.15,zz);
  } else for(let zz=-7;zz>=-18;zz-=3)addCoin(g,roof,0,1.15,zz);
}
const coinGeometry=new THREE.OctahedronGeometry(.38,0);
const coinMat=new THREE.MeshStandardMaterial({color:'#ffd45d',emissive:'#dc831f',emissiveIntensity:.3,metalness:.3,roughness:.35});
function addCoin(g,roof,x,y,z){const mesh=new THREE.Mesh(coinGeometry,coinMat);mesh.position.set(x,y,z);mesh.castShadow=true;g.add(mesh);const ring=new THREE.Mesh(ringGeometry,mat('#ffe8a1'));ring.rotation.x=Math.PI/2;mesh.add(ring);coins.push({mesh,roof,x,y,z:roof.z+z,collected:false});}
function resetWorld(){
 for(const s of segments){s.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});world.remove(s.group);}
 for(const p of particles)scene.remove(p.mesh);
 segments.length=obstacles.length=coins.length=particles.length=0;
 nextRoofEdge=20;roofIndex=0;randomState=431+(runSeed++%100)*19;
 while(nextRoofEdge>-250)addRoof();
 distance=0;shards=0;lane=1;y=vy=elapsed=coyote=jumpBuffer=0;falling=false;
 for(const c of city){c.initialZ=c.startZ;c.group.position.z=c.startZ;}
 world.position.z=0;player.position.set(0,0,0);player.rotation.set(0,0,0);
 updateHUD();
}
function playSound(frequency, duration=.12, type='sine',volume=.045){
 if(!soundOn)return;
 try {audio ??= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(frequency*.65,audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{/* Sound is optional. */}
}
const particleGeometry=new THREE.BoxGeometry(.13,.13,.13);
function burst(x,y,z){for(let i=0;i<9;i++){const mesh=new THREE.Mesh(particleGeometry,coinMat);mesh.position.set(x,y,z);scene.add(mesh);particles.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*6,2+Math.random()*4,(Math.random()-.5)*6),life:.65});}}
function updateHUD(){ $('score').textContent=String(scoreFor(distance,shards)).padStart(5,'0');$('distance').textContent=Math.floor(distance);$('shards').textContent=shards;$('menu-best').textContent=best.toLocaleString();}
function setMode(next){mode=next;game.dataset.state=next;const menu=next==='menu';for(const id of ['intro','best-card','world-label'])$(id).hidden=!menu;$('hud').hidden=menu;$('touch-controls').hidden=next!=='running';$('run-tip').hidden=next!=='running';$('result-layer').hidden=next!=='paused'&&next!=='over';}
function start(){resetWorld();setMode('running');lastTime=performance.now();playSound(440,.18);}
function pause(){if(mode!=='running')return;setMode('paused');$('result-eyebrow').textContent='A LITTLE BREATHER';$('result-title').textContent='Run paused.';$('result-message').textContent='The sunset can wait. Ready when you are.';$('result-stats').hidden=true;$('resume-button').firstElementChild.textContent='Keep going';$('resume-button').focus();}
function resume(){if(mode==='paused'){setMode('running');lastTime=performance.now();}else start();}
function end(reason){if(mode!=='running')return;setMode('over');const score=scoreFor(distance,shards),record=score>best;if(record){best=score;safeSave(storage,'skyline-best',best);}updateHUD();$('result-eyebrow').textContent=record?'A NEW PERSONAL BEST ✧':'THERE’S ALWAYS ANOTHER ROOFTOP';$('result-title').textContent=record?'Look at you go.':'One more run?';$('result-message').textContent=reason==='gap'?'Mind the gap. Jump just before the rooftop ends.':'Those air vents are sneaky. Jump over or switch lanes.';$('result-stats').hidden=false;$('final-score').textContent=score.toLocaleString();$('final-distance').textContent=`${Math.floor(distance)}m`;$('final-shards').textContent=shards;$('resume-button').firstElementChild.textContent='Run it back';playSound(130,.4,'triangle');$('resume-button').focus();}
function home(){setMode('menu');resetWorld();$('play-button').focus();}
function jump(){if(mode!=='running')return;jumpBuffer=.16;}
function move(dir){if(mode==='running')lane=THREE.MathUtils.clamp(lane+dir,0,2);}
$('play-button').addEventListener('click',start);$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',resume);$('home-button').addEventListener('click',home);
$('sound-button').addEventListener('click',()=>{soundOn=!soundOn;$('sound-button').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound-button').title=soundOn?'Mute sound':'Enable sound';$('sound-wave').setAttribute('d',soundOn?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 6 6m0-6-6 6');if(soundOn)playSound(660,.2);});
function applyColour(value){colour=value;jersey.color.set(value);document.querySelectorAll('.swatch').forEach(b=>{const active=b.dataset.color.toLowerCase()===value.toLowerCase();b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{applyColour(b.dataset.color);safeSave(storage,'skyline-colour',colour);}));applyColour(colour);
function openHelp(){wasRunningBeforeHelp=mode==='running';if(wasRunningBeforeHelp)pause();$('help-dialog').showModal();}
function closeHelp(){$('help-dialog').close();}
$('how-button').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);$('help-done').addEventListener('click',closeHelp);
$('help-dialog').addEventListener('close',()=>{if(wasRunningBeforeHelp&&mode==='paused')resume();wasRunningBeforeHelp=false;});
window.addEventListener('keydown',event=>{
 if($('help-dialog').open)return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
 if(event.repeat)return;
 if(event.code==='KeyP'||event.code==='Escape'){if(mode==='running')pause();else if(mode==='paused')resume();return;}
 if(mode!=='running')return;
 if(['ArrowLeft','KeyA'].includes(event.code))move(-1);
 if(['ArrowRight','KeyD'].includes(event.code))move(1);
 if(['Space','ArrowUp','KeyW'].includes(event.code))jump();
});
for(const [id,action] of [['left-button',()=>move(-1)],['right-button',()=>move(1)],['jump-button',jump]])$(id).addEventListener('pointerdown',e=>{e.preventDefault();action();});
let touchStart=null;
renderer.domElement.addEventListener('pointerdown',e=>{touchStart={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>30&&Math.abs(dx)>Math.abs(dy))move(Math.sign(dx));else if(dy< -25)jump();else if(Math.abs(dx)<15&&Math.abs(dy)<15)jump();});
renderer.domElement.addEventListener('pointercancel',()=>{touchStart=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);

// start.ng bridge: identity is fetched by the platform host, never from query-string tokens.
// Hosts may supply a same-origin session or trusted start.ng postMessage payload.
let hostSession=null;
function applySession(session){
 if(!session||typeof session!=='object')return;
 const name=String(session.user?.name||session.user?.email||'').slice(0,80);
 if(!name)return;
 hostSession={user:{id:session.user.id,name},appearance:session.appearance||{}};
 $('identity').textContent=`Running as ${name}`;
 const c=session.appearance?.primaryColor;
 if(typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))applyColour(c);
}
const trustedHostOrigins=new Set(['https://start.ng','https://www.start.ng','http://localhost:5173']);
window.addEventListener('message',e=>{if(window.parent===window||e.source!==window.parent||!trustedHostOrigins.has(e.origin))return;if(e.data?.type==='startng:session')applySession(e.data.session);});
if(window.parent!==window){for(const origin of trustedHostOrigins)window.parent.postMessage({type:'skyline:ready',version:1},origin);}
window.SkylineRush=Object.freeze({setSession:applySession,getSession:()=>hostSession?structuredClone(hostSession):null});

function resize(){const w=game.clientWidth,h=game.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(game);resize();resetWorld();
function cameraFrame(dt){
 const mobile=game.clientWidth<700,menu=mode==='menu';
 const target=menu?(mobile?new THREE.Vector3(-7,0,-9):new THREE.Vector3(-11,0,-12)):new THREE.Vector3(player.position.x*.23,1,-14);
 const position=menu?(mobile?new THREE.Vector3(26,28,39):new THREE.Vector3(23,24,36)):new THREE.Vector3(9.5+player.position.x*.18,12.5,22);
 const ease=1-Math.exp(-dt*3);
 camera.position.lerp(position,ease||1);
 camera.userData.target??=target.clone();camera.userData.target.lerp(target,ease||1);camera.lookAt(camera.userData.target);
 camera.fov=THREE.MathUtils.lerp(camera.fov,mobile?(menu?43:50):39,ease);camera.updateProjectionMatrix();
}
camera.position.set(23,24,36);cameraFrame(1);
let simAccumulator=0,renderTime=0;
function simulate(dt){
 elapsed+=dt;distance+=speedAt(distance)*dt;world.position.z=distance;
 const onRoof=isOnRoof(segments,distance);
 if(onRoof&&!falling&&y<=.02){y=0;vy=0;coyote=.11;}else coyote-=dt;
 jumpBuffer-=dt;
 if(jumpBuffer>0&&coyote>0&&!falling){vy=JUMP_SPEED;coyote=0;jumpBuffer=0;playSound(390,.16,'triangle');}
 if(y>0||vy>0||!onRoof||falling){vy-=GRAVITY*dt;y+=vy*dt;if(onRoof&&y<0&&vy<0&&!falling){y=0;vy=0;playSound(110,.055,'triangle',.015);}}
 if(y<-.45)falling=true;
 player.position.x=THREE.MathUtils.damp(player.position.x,LANES[lane],15,dt);player.position.y=y;
 player.rotation.z=THREE.MathUtils.damp(player.rotation.z,(LANES[lane]-player.position.x)*-.1,12,dt);
 if(y< -7){end('gap');return;}
 for(const o of obstacles)if(hitsObstacle(player.position.x,y,0,{...o,z:o.z+distance})){end('obstacle');return;}
 for(const c of coins){
  if(c.collected)continue;
  if(Math.abs(c.z+distance)<.9&&Math.abs(c.x-player.position.x)<.9&&Math.abs(c.y-(y+1.15))<1.2){c.collected=true;c.mesh.visible=false;shards++;burst(c.x,c.y,c.z+distance);playSound(780+(shards%5)*100,.12);}
 }
 for(let i=segments.length-1;i>=0;i--){const s=segments[i];if(s.z+distance-s.length/2>32){s.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});world.remove(s.group);segments.splice(i,1);for(let j=obstacles.length-1;j>=0;j--)if(obstacles[j].roof===s)obstacles.splice(j,1);for(let j=coins.length-1;j>=0;j--)if(coins[j].roof===s)coins.splice(j,1);}}
 while(nextRoofEdge+distance>-230)addRoof();
 for(const c of city){c.group.position.z=c.initialZ+distance*.45;while(c.group.position.z>65){c.initialZ-=245;c.group.position.z-=245;}}
 $('run-tip').textContent=distance<20?'Pick up the sun shards. You’ve got this.':distance<55?'Air vents ahead. Switch lanes or jump.':distance<90?'Rooftop gaps ahead. Jump at the yellow edge.':distance<250?'Find your flow. Keep chasing the sunset.':`${Math.floor(speedAt(distance)*3.6)} km/h · The city’s picking up the pace.`;
}
function frame(now){
 const dt=Math.min((now-(lastTime||now))/1000,.05);lastTime=now;renderTime+=dt;
 if(mode==='running'){simAccumulator+=dt;let ticks=0;while(simAccumulator>=1/120&&ticks++<8&&mode==='running'){simulate(1/120);simAccumulator-=1/120;}updateHUD();}else simAccumulator=0;
 const running=mode==='running',walk=running?elapsed*16:renderTime*2;
 body.position.y=running?(y<.01?Math.abs(Math.sin(walk))*.07:0):(!reducedMotion?Math.sin(renderTime*2)*.035:0);
 for(let i=0;i<2;i++){
  legs[i].rotation.x=running?(y>.15?(i===0?-.7:.5):Math.sin(walk+i*Math.PI)*.75):0;
  arms[i].rotation.x=running?(y>.15?-1:Math.sin(walk+i*Math.PI)*-.65):-.1;
 }
 shadow.position.x=player.position.x;shadow.scale.setScalar(Math.max(.25,1-y*.16));shadow.material.opacity=Math.max(0,.2-y*.035);shadow.visible=!falling;
 for(const c of coins)if(!c.collected){c.mesh.rotation.y=renderTime*1.8;c.mesh.position.y=c.y+Math.sin(renderTime*3+c.z)*.12;}
 if(mode==='running')for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.velocity.y-=12*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=dt*4;p.mesh.scale.setScalar(Math.max(0,p.life/.65));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
 cameraFrame(dt);renderer.render(scene,camera);requestAnimationFrame(frame);
}
$('loading').hidden=true;
requestAnimationFrame(frame);

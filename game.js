(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const canvas = $('#game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const ui = {
    hud: $('#hud'), title: $('#titleScreen'), classes: $('#classScreen'), level: $('#levelScreen'), loot: $('#lootScreen'), menu: $('#menuScreen'), death: $('#deathScreen'),
    continueBtn: $('#continueBtn'), newGameBtn: $('#newGameBtn'), installBtn: $('#installBtn'), classBackBtn: $('#classBackBtn'),
    levelText: $('#levelText'), hpFill: $('#hpFill'), hpText: $('#hpText'), xpFill: $('#xpFill'), xpText: $('#xpText'), goldText: $('#goldText'), shardText: $('#shardText'), classIcon: $('#classIcon'),
    zoneText: $('#zoneText'), objectiveText: $('#objectiveText'), joystick: $('#joystick'), stick: $('#stick'), dashBtn: $('#dashBtn'), skillBtn: $('#skillBtn'), potionBtn: $('#potionBtn'), potionText: $('#potionText'),
    dashText: $('#dashText'), skillText: $('#skillText'), menuBtn: $('#menuBtn'), closeMenuBtn: $('#closeMenuBtn'), heroName: $('#heroName'),
    tabStats: $('#tabStats'), tabGear: $('#tabGear'), tabMastery: $('#tabMastery'), perkChoices: $('#perkChoices'), lootChoices: $('#lootChoices'),
    toast: $('#toast'), reviveBtn: $('#reviveBtn'), deathMenuBtn: $('#deathMenuBtn'), deathSummary: $('#deathSummary')
  };

  const STORAGE = 'riftforge-save-v1';
  const WORLD = { w: 2600, h: 2600 };
  const TAU = Math.PI * 2;
  const ZONES = [
    { name:'Ashen Meadow', ground:'#17231f', accent:'#405e45', haze:'#87a96e', enemy:'moss' },
    { name:'Sunken Chapel', ground:'#171e22', accent:'#3b5059', haze:'#6890a0', enemy:'shade' },
    { name:'Ember Quarry', ground:'#241b18', accent:'#654134', haze:'#b86846', enemy:'ember' },
    { name:'Frostworn Pass', ground:'#182126', accent:'#47606b', haze:'#8fc4d5', enemy:'frost' },
    { name:'Voidgarden', ground:'#201824', accent:'#5d4068', haze:'#af70be', enemy:'void' }
  ];

  const CLASS_DATA = {
    bladesworn: { name:'Bladesworn', icon:'⚔', hp:145, speed:205, damage:19, attackRate:.62, range:92, crit:.08, color:'#f0c66a', skill:'Whirlwind' },
    ranger: { name:'Ranger', icon:'➶', hp:112, speed:225, damage:15, attackRate:.40, range:330, crit:.18, color:'#79e1b4', skill:'Volley' },
    arcanist: { name:'Arcanist', icon:'✦', hp:102, speed:210, damage:22, attackRate:.72, range:360, crit:.10, color:'#86b8ff', skill:'Nova' }
  };

  const RARITIES = [
    { key:'common', label:'Common', mult:1.0, weight:55 },
    { key:'magic', label:'Magic', mult:1.22, weight:26 },
    { key:'rare', label:'Rare', mult:1.5, weight:13 },
    { key:'epic', label:'Epic', mult:1.9, weight:5 },
    { key:'mythic', label:'Mythic', mult:2.45, weight:1 }
  ];

  const GEAR_NAMES = {
    weapon:['Riftfang','Mooncleaver','Ashbrand','Gale Needle','Starcaller','Gravetide','Warden Edge','Glass Thorn'],
    armor:['Ironbark Mail','Shadeweave','Pilgrim Plate','Stormhide','Cinder Mantle','Warden Carapace'],
    charm:['Ember Sigil','Hunter Knot','Pale Coin','Astral Lens','Vowstone','Glass Heart']
  };

  const PERKS = [
    { id:'power', icon:'⚔', title:'Tempered Edge', desc:'+18% damage.', apply:p=>p.damageMult*=1.18 },
    { id:'haste', icon:'⌁', title:'Quick Hands', desc:'+15% attack speed.', apply:p=>p.attackRateMult*=1.15 },
    { id:'vitality', icon:'♥', title:'Vital Core', desc:'+22% max health and heal 22%.', apply:p=>p.hpMult*=1.22 },
    { id:'stride', icon:'➤', title:'Ghost Step', desc:'+10% move speed. Dash cooldown -8%.', apply:p=>{p.speedMult*=1.10;p.dashCdMult*=.92} },
    { id:'crit', icon:'✧', title:'Keen Instinct', desc:'+7% critical chance.', apply:p=>p.crit+=.07 },
    { id:'magnet', icon:'◉', title:'Soul Magnet', desc:'+45% pickup radius. +10% XP.', apply:p=>{p.pickup*=1.45;p.xpMult*=1.10} },
    { id:'leech', icon:'♢', title:'Blood Oath', desc:'Heal 2.5% of damage dealt.', apply:p=>p.lifesteal+=.025 },
    { id:'guard', icon:'⬡', title:'Runic Guard', desc:'Take 12% less damage.', apply:p=>p.damageReduction=1-(1-p.damageReduction)*.88 },
    { id:'multishot', icon:'⋔', title:'Echo Strike', desc:'20% chance to repeat an attack.', apply:p=>p.echoChance+=.20 },
    { id:'burn', icon:'♨', title:'Cinder Mark', desc:'Attacks ignite enemies for bonus damage.', apply:p=>p.burn+=.16 },
    { id:'execution', icon:'☠', title:'Executioner', desc:'+35% damage to enemies below 30% health.', apply:p=>p.execute+=.35 },
    { id:'fortune', icon:'◈', title:'Fortune Seeker', desc:'+30% gold and better loot odds.', apply:p=>{p.perkGoldMult*=1.30;p.luck+=.10} }
  ];

  let dpr = 1, W = 0, H = 0, last = performance.now(), running = false, paused = true;
  let save = null, player = null, camera = {x:0,y:0};
  let enemies = [], projectiles = [], gems = [], particles = [], floaters = [], pickups = [], scenery = [];
  let spawnTimer = 0, stageKills = 0, stageTarget = 20, bossAlive = false, lastSave = 0, gameTime = 0;
  let keys = new Set(), joy = {active:false, id:null, x:0, y:0, mag:0};
  let deferredPrompt = null, toastTimer = 0, visibilityPaused = false;

  function resize(){
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect(); W = rect.width; H = rect.height;
    canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  addEventListener('resize', resize, {passive:true}); resize();

  function rand(a=1,b=0){ return b + Math.random()*(a-b); }
  function irand(a,b=0){ return Math.floor(rand(a,b)); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function dist2(a,b){ const dx=a.x-b.x,dy=a.y-b.y; return dx*dx+dy*dy; }
  function angle(a,b){ return Math.atan2(b.y-a.y,b.x-a.x); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function fmt(n){ if(n<1000)return Math.floor(n).toString(); if(n<1e6)return (n/1e3).toFixed(n<1e4?1:0)+'K'; return (n/1e6).toFixed(1)+'M'; }

  function freshSave(cls){
    return {
      version:1, classId:cls, level:1, xp:0, xpNeed:32, gold:0, shards:0, potions:3, zoneIndex:0, stage:1,
      totalKills:0, bosses:0, deaths:0, playTime:0, gearLevel:0,
      gear:{weapon:null,armor:null,charm:null},
      mastery:{might:0,vigor:0,fortune:0},
      perkStacks:{},
      seenTutorial:true
    };
  }

  function load(){
    try { const raw = localStorage.getItem(STORAGE); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function persist(){
    if(!save || !player) return;
    save.level=player.level; save.xp=player.xp; save.xpNeed=player.xpNeed; save.gold=Math.floor(player.gold); save.shards=Math.floor(player.shards); save.potions=player.potions;
    save.zoneIndex=player.zoneIndex; save.stage=player.stage; save.totalKills=player.totalKills; save.bosses=player.bosses; save.playTime+=Math.max(0,gameTime-lastSave); lastSave=gameTime;
    localStorage.setItem(STORAGE, JSON.stringify(save));
  }

  function makePlayer(){
    const c=CLASS_DATA[save.classId];
    const p={x:WORLD.w/2,y:WORLD.h/2,r:18, classId:save.classId, level:save.level,xp:save.xp,xpNeed:save.xpNeed,gold:save.gold,shards:save.shards,potions:save.potions,zoneIndex:save.zoneIndex,stage:save.stage,totalKills:save.totalKills,bosses:save.bosses,
      baseMaxHp:c.hp,baseDamage:c.damage,baseSpeed:c.speed,baseAttackRate:c.attackRate,range:c.range,crit:c.crit,
      damageMult:1,attackRateMult:1,speedMult:1,hpMult:1,dashCdMult:1,xpMult:1,perkGoldMult:1,goldMult:1,pickup:115,lifesteal:0,damageReduction:0,echoChance:0,burn:0,execute:0,luck:0,
      attackTimer:0,dashTimer:0,skillTimer:0,invuln:0,hitFlash:0,dashX:0,dashY:0,dashing:0, facing:0, trail:[],
      maxHp:1,hp:1
    };
    for(const [id,count] of Object.entries(save.perkStacks||{})){
      const perk=PERKS.find(x=>x.id===id); if(perk) for(let i=0;i<count;i++) perk.apply(p);
    }
    applyDerived(p);
    p.hp=p.maxHp;
    return p;
  }

  function applyDerived(p){
    const gear=save.gear||{}; let hpBonus=0, damageBonus=0, speedBonus=0, critBonus=0, rateBonus=0;
    Object.values(gear).filter(Boolean).forEach(g=>{hpBonus+=g.hp||0;damageBonus+=g.damage||0;speedBonus+=g.speed||0;critBonus+=g.crit||0;rateBonus+=g.rate||0;});
    const m=save.mastery||{might:0,vigor:0,fortune:0};
    p.maxHp=(p.baseMaxHp+hpBonus)*p.hpMult*(1+(m.vigor||0)*.05);
    p.damage=(p.baseDamage+damageBonus)*p.damageMult*(1+(m.might||0)*.05);
    p.speed=(p.baseSpeed+speedBonus)*p.speedMult;
    p.attackRate=p.baseAttackRate/(p.attackRateMult*(1+rateBonus));
    p.critChance=clamp(p.crit+critBonus,0,.75);
    p.goldMult=p.perkGoldMult*(1+(m.fortune||0)*.08);
  }

  function startGame(fromSave=true){
    if(!fromSave){ save=freshSave(save.classId); }
    player=makePlayer();
    enemies=[]; projectiles=[]; gems=[]; particles=[]; floaters=[]; pickups=[]; scenery=[];
    stageKills=0; bossAlive=false; spawnTimer=.5; gameTime=0; lastSave=0;
    stageTarget=20+Math.min(30,(player.stage-1)*3);
    buildScenery();
    hideAllScreens(); ui.hud.classList.remove('hidden'); ui.hud.setAttribute('aria-hidden','false');
    running=true; paused=false; updateHUD(); toast(`Entered ${ZONES[player.zoneIndex].name}`);
    last=performance.now(); requestAnimationFrame(loop);
  }

  function hideAllScreens(){ [ui.title,ui.classes,ui.level,ui.loot,ui.menu,ui.death].forEach(x=>x.classList.add('hidden')); }
  function title(){
    persist(); running=false; paused=true; ui.hud.classList.add('hidden'); hideAllScreens(); ui.title.classList.remove('hidden');
    save=load(); ui.continueBtn.classList.toggle('hidden',!save); if(save) ui.newGameBtn.textContent='NEW HERO';
  }

  function buildScenery(){
    scenery=[]; const z=ZONES[player.zoneIndex];
    for(let i=0;i<120;i++) scenery.push({x:rand(WORLD.w-100,100),y:rand(WORLD.h-100,100),r:rand(30,8),rot:rand(TAU),type:i%5===0?'stone':'tuft',c:z.accent});
    for(let i=0;i<22;i++) scenery.push({x:rand(WORLD.w-140,140),y:rand(WORLD.h-140,140),r:rand(54,26),rot:rand(TAU),type:'pillar',c:z.accent});
  }

  function spawnEnemy(forceBoss=false){
    const boss=forceBoss;
    let a=rand(TAU), r=rand(720,430), x=clamp(player.x+Math.cos(a)*r,60,WORLD.w-60), y=clamp(player.y+Math.sin(a)*r,60,WORLD.h-60);
    const s=player.stage, z=player.zoneIndex;
    const roll=Math.random(); let type=roll<.16?'brute':roll<.32?'spitter':'crawler';
    if(boss) type='boss';
    const scale=1+(s-1)*.115+z*.24;
    const data = type==='crawler'?{r:15,hp:35,spd:92,dmg:9,xp:8,gold:2}:
                 type==='brute'?{r:24,hp:92,spd:58,dmg:17,xp:17,gold:5}:
                 type==='spitter'?{r:17,hp:52,spd:72,dmg:11,xp:13,gold:4}:
                 {r:43,hp:520,spd:64,dmg:22,xp:105,gold:48};
    const hp=data.hp*scale*(boss?1+player.stage*.08:1);
    enemies.push({x,y,r:data.r*(boss?1.1:1),type,boss,hp,maxHp:hp,spd:data.spd*(1+Math.min(.35,s*.012)),dmg:data.dmg*scale,xp:data.xp*(1+s*.035),gold:data.gold*(1+s*.04),hit:0,attack:rand(.6,.1),shot:rand(1.8,.5),burn:0,burnDmg:0,burnTick:0,phase:0,dead:false});
    if(boss){ bossAlive=true; toast('RIFT WARDEN AWAKENED'); }
  }

  function spawnLogic(dt){
    if(bossAlive) return;
    if(stageKills>=stageTarget){ if(!enemies.some(e=>e.boss)) spawnEnemy(true); return; }
    spawnTimer-=dt; const cap=Math.min(28,9+player.stage*2);
    if(spawnTimer<=0 && enemies.length<cap){ spawnEnemy(false); spawnTimer=Math.max(.24,.85-player.stage*.025); }
  }

  function movement(dt){
    let dx=joy.x,dy=joy.y;
    if(keys.has('w')||keys.has('arrowup'))dy-=1;if(keys.has('s')||keys.has('arrowdown'))dy+=1;if(keys.has('a')||keys.has('arrowleft'))dx-=1;if(keys.has('d')||keys.has('arrowright'))dx+=1;
    const len=Math.hypot(dx,dy); if(len>1){dx/=len;dy/=len}
    if(len>.05) player.facing=Math.atan2(dy,dx);
    if(player.dashing>0){
      player.dashing-=dt; player.x+=player.dashX*760*dt;player.y+=player.dashY*760*dt;
      if(Math.random()<.7) particles.push({x:player.x,y:player.y,vx:rand(30,-30),vy:rand(30,-30),life:.3,max:.3,r:rand(6,2),c:CLASS_DATA[player.classId].color});
    } else { player.x+=dx*player.speed*dt; player.y+=dy*player.speed*dt; }
    player.x=clamp(player.x,28,WORLD.w-28);player.y=clamp(player.y,28,WORLD.h-28);
    player.dashTimer=Math.max(0,player.dashTimer-dt);player.skillTimer=Math.max(0,player.skillTimer-dt);player.invuln=Math.max(0,player.invuln-dt);player.hitFlash=Math.max(0,player.hitFlash-dt);
  }

  function nearestEnemy(range=99999){
    let best=null,bd=range*range; for(const e of enemies){ if(e.dead)continue; const d=dist2(player,e);if(d<bd){bd=d;best=e;} } return best;
  }

  function combat(dt){
    player.attackTimer-=dt;
    const target=nearestEnemy(player.range);
    if(target && player.attackTimer<=0){
      player.attackTimer=player.attackRate;
      basicAttack(target);
      if(Math.random()<player.echoChance) setTimeout(()=>{if(running&&!paused&&target&&!target.dead)basicAttack(target,.68)},70);
    }
  }

  function basicAttack(target,mult=1){
    const c=player.classId, a=angle(player,target); player.facing=a;
    if(c==='bladesworn'){
      const hit=[]; for(const e of enemies){if(e.dead)continue;const d=Math.sqrt(dist2(player,e));if(d<104+e.r){let da=Math.abs(Math.atan2(Math.sin(angle(player,e)-a),Math.cos(angle(player,e)-a)));if(da<.72)hit.push(e);}}
      hit.forEach(e=>deal(e,player.damage*mult)); slashFX(a);
    } else {
      const speed=c==='ranger'?630:490;
      projectiles.push({x:player.x+Math.cos(a)*22,y:player.y+Math.sin(a)*22,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:c==='ranger'?4:7,life:1.25,damage:player.damage*mult,from:'player',kind:c==='ranger'?'arrow':'orb',target:c==='arcanist'?target:null,pierce:c==='arcanist'?1:0,color:CLASS_DATA[c].color});
      burst(player.x+Math.cos(a)*24,player.y+Math.sin(a)*24,CLASS_DATA[c].color,3,50);
    }
  }

  function deal(e,amount,opts={}){
    let crit=Math.random()<player.critChance; if(crit) amount*=1.75;
    if(e.hp/e.maxHp<.3) amount*=1+player.execute;
    e.hp-=amount;e.hit=.11;
    if(player.lifesteal){player.hp=Math.min(player.maxHp,player.hp+amount*player.lifesteal)}
    if(player.burn && Math.random()<.55){e.burn=2.3;e.burnDmg=Math.max(e.burnDmg,player.damage*player.burn);}
    floater(e.x,e.y-e.r,Math.round(amount),crit?'#f7d16f':'#e8f4ef',crit?15:11);
    if(e.hp<=0) killEnemy(e);
  }

  function killEnemy(e){
    if(e.dead)return;e.dead=true;
    burst(e.x,e.y,e.boss?'#f4c66d':'#9ab8aa',e.boss?28:9,e.boss?210:90);
    const gemCount=e.boss?10:Math.max(1,Math.round(e.xp/12));
    for(let i=0;i<gemCount;i++) gems.push({x:e.x+rand(38,-38),y:e.y+rand(38,-38),vx:rand(60,-60),vy:rand(60,-60),xp:e.xp/gemCount,r:e.boss?6:4,t:0});
    const gold=e.gold*player.goldMult; player.gold+=gold; player.totalKills++; stageKills++;
    if(Math.random()<.09) pickups.push({x:e.x+rand(20,-20),y:e.y+rand(20,-20),type:'potion',r:9});
    if(e.boss){
      bossAlive=false;player.bosses++;player.shards+=2+Math.floor(player.stage/3);stageKills=0;player.stage++;
      if(player.stage%4===1){player.zoneIndex=(player.zoneIndex+1)%ZONES.length; buildScenery();}
      stageTarget=20+Math.min(30,(player.stage-1)*3);
      setTimeout(()=>{ if(running){paused=true; showLoot();}},450);
    }
  }

  function enemyUpdate(e,dt){
    e.hit=Math.max(0,e.hit-dt); e.attack-=dt; e.shot-=dt;
    if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){e.burnTick=.45;e.hp-=e.burnDmg;floater(e.x,e.y-e.r,Math.round(e.burnDmg),'#e88153',9);if(e.hp<=0){killEnemy(e);return;}}}
    let dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
    if(e.type==='spitter' && d<250){ nx*=-.42;ny*=-.42; }
    else if(e.type==='spitter' && d<380){ nx=0;ny=0; }
    e.x+=nx*e.spd*dt;e.y+=ny*e.spd*dt;
    if(e.type==='spitter' && d<420 && e.shot<=0){
      e.shot=1.75; projectiles.push({x:e.x,y:e.y,vx:(dx/d)*270,vy:(dy/d)*270,r:6,life:2,damage:e.dmg,from:'enemy',kind:'enemy',color:'#e06f66'});
    }
    if(e.boss){
      e.phase+=dt;
      if(e.shot<=0 && d<560){e.shot=2.4;for(let i=0;i<10;i++){const a=i/10*TAU+e.phase;projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*230,vy:Math.sin(a)*230,r:7,life:2.7,damage:e.dmg*.72,from:'enemy',kind:'enemy',color:'#f0b15f'});}}
    }
    if(d<e.r+player.r+4 && e.attack<=0){ e.attack=e.boss?.72:1.0; hurt(e.dmg); }
  }

  function hurt(amount){
    if(player.invuln>0)return; amount*=1-player.damageReduction;player.hp-=amount;player.invuln=.32;player.hitFlash=.18;floater(player.x,player.y-30,Math.round(amount),'#ff737b',13);burst(player.x,player.y,'#ff6570',6,80);
    if(player.hp<=0) die();
  }

  function projectileUpdate(p,dt){
    if(p.target && !p.target.dead){const a=Math.atan2(p.target.y-p.y,p.target.x-p.x),speed=Math.hypot(p.vx,p.vy);p.vx=lerp(p.vx,Math.cos(a)*speed,.08);p.vy=lerp(p.vy,Math.sin(a)*speed,.08)}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    if(p.from==='player'){
      for(const e of enemies){if(e.dead||p.life<=0)continue;if((p.x-e.x)**2+(p.y-e.y)**2<(p.r+e.r)**2){deal(e,p.damage);burst(p.x,p.y,p.color,4,60);if(p.pierce>0)p.pierce--;else p.life=0;}}
    } else if((p.x-player.x)**2+(p.y-player.y)**2<(p.r+player.r)**2){hurt(p.damage);p.life=0;}
  }

  function gemUpdate(g,dt){
    g.t+=dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.vx*=Math.pow(.02,dt);g.vy*=Math.pow(.02,dt);
    let dx=player.x-g.x,dy=player.y-g.y,d=Math.hypot(dx,dy)||1;
    if(d<player.pickup){const s=clamp(700*(1-d/player.pickup)+180,180,700);g.x+=dx/d*s*dt;g.y+=dy/d*s*dt;}
    if(d<22){gainXP(g.xp*player.xpMult);g.dead=true;}
  }

  function gainXP(xp){
    player.xp+=xp;
    if(player.xp>=player.xpNeed){player.xp-=player.xpNeed;player.level++;player.xpNeed=Math.floor(player.xpNeed*1.22+7); paused=true; showLevelUp();}
  }

  function showLevelUp(){
    const choices=[...PERKS].sort(()=>Math.random()-.5).slice(0,3); ui.perkChoices.innerHTML='';
    choices.forEach(perk=>{
      const stack=save.perkStacks[perk.id]||0; const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="choice-icon">${perk.icon}</span><span><strong>${perk.title}</strong><small>${perk.desc}</small></span><span class="rank">${stack?`Rank ${stack+1}`:'NEW'}</span>`;
      b.onclick=()=>{const oldMax=player.maxHp;save.perkStacks[perk.id]=(save.perkStacks[perk.id]||0)+1;perk.apply(player);applyDerived(player);if(perk.id==='vitality')player.hp=Math.min(player.maxHp,player.hp+(player.maxHp-oldMax)+player.maxHp*.12);ui.level.classList.add('hidden');paused=false;toast(perk.title);persist();};ui.perkChoices.appendChild(b);
    });
    ui.level.classList.remove('hidden'); updateHUD();
  }

  function rollRarity(){
    const luck=player.luck||0; let r=Math.random()*100, acc=0;
    for(let i=RARITIES.length-1;i>=0;i--){const rr=RARITIES[i];const boosted=rr.weight*(i===0?1:(1+luck*(i+1)));acc+=boosted;if(r<acc)return rr;}
    return RARITIES[0];
  }

  function makeGear(slot){
    const rarity=rollRarity(), ilvl=player.stage+player.zoneIndex*3, scale=(1+ilvl*.12)*rarity.mult;
    const g={slot,rarity:rarity.key,rarityLabel:rarity.label,name:GEAR_NAMES[slot][irand(GEAR_NAMES[slot].length)],level:ilvl};
    if(slot==='weapon'){g.damage=Math.round((4+ilvl*1.15)*scale);if(Math.random()<.4)g.crit=+(0.02*rarity.mult).toFixed(3)}
    if(slot==='armor'){g.hp=Math.round((18+ilvl*4)*scale);if(Math.random()<.35)g.speed=Math.round(3*rarity.mult)}
    if(slot==='charm'){g.crit=+(0.025*rarity.mult).toFixed(3);g.rate=+(0.025*rarity.mult).toFixed(3);if(Math.random()<.4)g.damage=Math.round(2*scale)}
    g.score=(g.damage||0)*4+(g.hp||0)*.55+(g.speed||0)*2+(g.crit||0)*240+(g.rate||0)*220;
    return g;
  }

  function gearDesc(g){ const bits=[];if(g.damage)bits.push(`+${g.damage} dmg`);if(g.hp)bits.push(`+${g.hp} hp`);if(g.speed)bits.push(`+${g.speed} speed`);if(g.crit)bits.push(`+${Math.round(g.crit*100)}% crit`);if(g.rate)bits.push(`+${Math.round(g.rate*100)}% haste`);return bits.join(' · '); }

  function showLoot(){
    const slots=['weapon','armor','charm'].sort(()=>Math.random()-.5); ui.lootChoices.innerHTML='';
    slots.forEach(slot=>{const g=makeGear(slot),old=save.gear[slot];const better=!old||g.score>old.score;const icon=slot==='weapon'?'⚔':slot==='armor'?'⬢':'◇';const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="choice-icon">${icon}</span><span><strong class="rarity-${g.rarity}">${g.name}</strong><small>${g.rarityLabel} ${slot} · ${gearDesc(g)}</small></span><span class="rank">${better?'▲ UPGRADE':'SIDEGRADE'}</span>`;
      b.onclick=()=>{const salvage=12+player.stage*3;save.gear[slot]=g;player.gold+=salvage*2;const hpPct=player.hp/player.maxHp;applyDerived(player);player.hp=Math.min(player.maxHp,Math.max(1,player.maxHp*hpPct));ui.loot.classList.add('hidden');paused=false;toast(`${g.name} equipped`);persist();updateHUD();};ui.lootChoices.appendChild(b);});
    ui.loot.classList.remove('hidden');
  }

  function usePotion(){if(paused||player.potions<=0||player.hp>=player.maxHp)return;player.potions--;const heal=player.maxHp*.42;player.hp=Math.min(player.maxHp,player.hp+heal);burst(player.x,player.y,'#74e6b9',12,100);floater(player.x,player.y-35,'+'+Math.round(heal),'#74e6b9',12);updateHUD();}
  function dash(){if(paused||player.dashTimer>0)return;let dx=joy.x,dy=joy.y,len=Math.hypot(dx,dy);if(len<.08){dx=Math.cos(player.facing);dy=Math.sin(player.facing);len=1}player.dashX=dx/len;player.dashY=dy/len;player.dashing=.17;player.invuln=.24;player.dashTimer=2.2*player.dashCdMult;}
  function skill(){
    if(paused||player.skillTimer>0)return; const c=player.classId;player.skillTimer=c==='bladesworn'?7:c==='ranger'?6.3:7.4;
    if(c==='bladesworn'){
      for(const e of enemies){if(!e.dead&&Math.sqrt(dist2(player,e))<170+e.r)deal(e,player.damage*2.15)}
      for(let i=0;i<28;i++){const a=i/28*TAU;particles.push({x:player.x+Math.cos(a)*55,y:player.y+Math.sin(a)*55,vx:Math.cos(a)*260,vy:Math.sin(a)*260,life:.45,max:.45,r:5,c:'#f2c96f'})}
    } else if(c==='ranger'){
      const base=nearestEnemy(500),a0=base?angle(player,base):player.facing;for(let i=-3;i<=3;i++){const a=a0+i*.15;projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*720,vy:Math.sin(a)*720,r:5,life:1,damage:player.damage*1.38,from:'player',kind:'arrow',color:'#79e1b4',pierce:2});}
    } else {
      const targets=[...enemies].filter(e=>!e.dead).sort((a,b)=>dist2(player,a)-dist2(player,b)).slice(0,8);targets.forEach((e,i)=>setTimeout(()=>{if(!e.dead){deal(e,player.damage*2.35);burst(e.x,e.y,'#86b8ff',10,120)}},i*55));
      for(let i=0;i<20;i++){const a=i/20*TAU;particles.push({x:player.x,y:player.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,life:.55,max:.55,r:6,c:'#86b8ff'})}
    }
  }

  function die(){
    if(paused)return;paused=true;save.deaths=(save.deaths||0)+1;const shardGain=Math.max(1,Math.floor((player.stage+player.level)/3));player.shards+=shardGain;persist();ui.deathSummary.textContent=`Stage ${player.stage} · Level ${player.level} · ${player.totalKills} total kills · +${shardGain} mastery shards`;ui.death.classList.remove('hidden');
  }

  function returnCamp(){
    enemies=[];projectiles=[];gems=[];pickups=[];stageKills=0;bossAlive=false;player.x=WORLD.w/2;player.y=WORLD.h/2;player.hp=player.maxHp;player.potions=Math.max(player.potions,3);player.dashTimer=0;player.skillTimer=0;ui.death.classList.add('hidden');paused=false;spawnTimer=.4;toast('Returned to camp');
  }

  function pickupUpdate(p){ if(dist2(player,p)<(player.r+p.r+14)**2){if(p.type==='potion'){player.potions=Math.min(9,player.potions+1);toast('Potion found');}p.dead=true;} }
  function burst(x,y,c,count=8,speed=80){for(let i=0;i<count;i++){const a=rand(TAU),s=rand(speed,speed*.25);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.55,.2),max:.55,r:rand(5,2),c})}}
  function slashFX(a){for(let i=0;i<10;i++){const aa=a+rand(.9,-.9),r=rand(80,28);particles.push({x:player.x+Math.cos(aa)*r,y:player.y+Math.sin(aa)*r,vx:Math.cos(aa)*100,vy:Math.sin(aa)*100,life:.18,max:.18,r:rand(7,3),c:'#f1d48b'})}}
  function floater(x,y,text,c='#fff',size=11){floaters.push({x,y,text:String(text),c,size,life:.75,max:.75})}
  function toast(t){ui.toast.textContent=t;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1400)}

  function update(dt){
    gameTime+=dt; movement(dt); combat(dt); spawnLogic(dt);
    for(const e of enemies) if(!e.dead) enemyUpdate(e,dt);
    for(const p of projectiles) projectileUpdate(p,dt);
    for(const g of gems) if(!g.dead)gemUpdate(g,dt);
    for(const p of pickups) if(!p.dead)pickupUpdate(p);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.08,dt);p.vy*=Math.pow(.08,dt);p.life-=dt}
    for(const f of floaters){f.y-=30*dt;f.life-=dt}
    enemies=enemies.filter(e=>!e.dead);projectiles=projectiles.filter(p=>p.life>0);gems=gems.filter(g=>!g.dead);pickups=pickups.filter(p=>!p.dead);particles=particles.filter(p=>p.life>0);floaters=floaters.filter(f=>f.life>0);
    camera.x=lerp(camera.x,player.x-W/2,.11);camera.y=lerp(camera.y,player.y-H/2,.11);camera.x=clamp(camera.x,0,Math.max(0,WORLD.w-W));camera.y=clamp(camera.y,0,Math.max(0,WORLD.h-H));
    if(gameTime-lastSave>8)persist();updateHUD();
  }

  function worldToScreen(x,y){return{x:x-camera.x,y:y-camera.y}}
  function draw(){
    if(!player){drawTitleBackdrop();return;} const z=ZONES[player.zoneIndex];ctx.fillStyle=z.ground;ctx.fillRect(0,0,W,H);
    drawGrid(z); drawScenery(); drawPickups(); drawGems(); drawEnemies(); drawProjectiles(); drawPlayer(); drawParticles(); drawFloaters(); drawVignette();
  }
  function drawTitleBackdrop(){ctx.fillStyle='#0a1014';ctx.fillRect(0,0,W,H)}
  function drawGrid(z){
    const size=72,ox=-(camera.x%size),oy=-(camera.y%size);ctx.strokeStyle=z.accent+'42';ctx.lineWidth=1;ctx.beginPath();for(let x=ox;x<W;x+=size){ctx.moveTo(x,0);ctx.lineTo(x,H)}for(let y=oy;y<H;y+=size){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();
    const grad=ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,Math.max(W,H)*.72);grad.addColorStop(0,'transparent');grad.addColorStop(1,z.haze+'18');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  }
  function drawScenery(){
    for(const s of scenery){const p=worldToScreen(s.x,s.y);if(p.x<-80||p.y<-80||p.x>W+80||p.y>H+80)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(s.rot);if(s.type==='tuft'){ctx.strokeStyle=s.c;ctx.globalAlpha=.38;ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<4;i++){ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*1.5)*s.r*.5,Math.sin(i*1.5)*s.r*.5)}ctx.stroke()}else if(s.type==='stone'){ctx.fillStyle=s.c+'55';ctx.beginPath();ctx.ellipse(0,0,s.r*.7,s.r*.38,.2,0,TAU);ctx.fill()}else{ctx.fillStyle=s.c+'40';ctx.fillRect(-s.r*.18,-s.r*.7,s.r*.36,s.r*1.4);ctx.fillStyle='#0003';ctx.fillRect(-s.r*.22,s.r*.35,s.r*.44,s.r*.18)}ctx.restore();}
  }
  function drawPlayer(){
    const p=worldToScreen(player.x,player.y),c=CLASS_DATA[player.classId];ctx.save();ctx.translate(p.x,p.y);ctx.rotate(player.facing);ctx.globalAlpha=player.invuln>0&&Math.floor(player.invuln*20)%2?0.45:1;
    ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(0,12,22,11,0,0,TAU);ctx.fill();
    ctx.fillStyle=player.hitFlash>0?'#fff':c.color;ctx.beginPath();ctx.arc(0,0,17,0,TAU);ctx.fill();ctx.fillStyle='#1a2428';ctx.beginPath();ctx.arc(-4,-4,11,0,TAU);ctx.fill();
    if(player.classId==='bladesworn'){ctx.strokeStyle='#e9eef0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(7,-5);ctx.lineTo(29,-5);ctx.stroke();ctx.strokeStyle='#947444';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(4,-8);ctx.lineTo(4,1);ctx.stroke()}
    if(player.classId==='ranger'){ctx.strokeStyle='#d9c48f';ctx.lineWidth=2;ctx.beginPath();ctx.arc(10,0,18,-1.25,1.25);ctx.stroke();ctx.beginPath();ctx.moveTo(16,-17);ctx.lineTo(16,17);ctx.stroke()}
    if(player.classId==='arcanist'){ctx.fillStyle='#c7ddff';ctx.beginPath();ctx.arc(23,0,5,0,TAU);ctx.fill();ctx.shadowBlur=14;ctx.shadowColor=c.color;ctx.fill();ctx.shadowBlur=0}
    ctx.restore();
  }
  function enemyColor(e){const z=ZONES[player.zoneIndex].enemy;const map={moss:'#7b9d63',shade:'#738992',ember:'#b65f42',frost:'#7eb5c2',void:'#9b69a5'};return e.boss?'#d79a52':map[z]}
  function drawEnemies(){
    for(const e of enemies){const p=worldToScreen(e.x,e.y);if(p.x<-80||p.y<-80||p.x>W+80||p.y>H+80)continue;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(0,e.r*.55,e.r*.85,e.r*.38,0,0,TAU);ctx.fill();let c=enemyColor(e);ctx.fillStyle=e.hit>0?'#fff':c;
      if(e.type==='crawler'){ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.fill();ctx.fillStyle='#17201b';ctx.fillRect(-8,-4,4,4);ctx.fillRect(4,-4,4,4)}
      else if(e.type==='brute'){ctx.beginPath();for(let i=0;i<7;i++){const a=i/7*TAU,r=i%2?e.r*.88:e.r*1.08;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.fillStyle='#191d1d';ctx.fillRect(-9,-5,18,5)}
      else if(e.type==='spitter'){ctx.rotate(gameTime*.5);ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU,r=i%2?e.r*.6:e.r;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill()}
      else {ctx.rotate(e.phase*.15);ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*TAU,r=i%2?e.r*.72:e.r*1.12;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.fillStyle='#2d1c18';ctx.beginPath();ctx.arc(0,0,e.r*.45,0,TAU);ctx.fill();}
      if(e.burn>0){ctx.strokeStyle='#ef8e53';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+4,0,TAU);ctx.stroke()}
      const ratio=clamp(e.hp/e.maxHp,0,1);if(e.boss||ratio<1){const bw=e.boss?88:36,by=-e.r-12;ctx.fillStyle='#0a0e10';ctx.fillRect(-bw/2,by,bw,5);ctx.fillStyle=e.boss?'#efb55e':'#e76a6c';ctx.fillRect(-bw/2,by,bw*ratio,5)}ctx.restore();}
  }
  function drawProjectiles(){for(const q of projectiles){const p=worldToScreen(q.x,q.y);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=q.color||'#fff';ctx.shadowColor=q.color||'#fff';ctx.shadowBlur=q.kind==='orb'?12:4;if(q.kind==='arrow'){ctx.rotate(Math.atan2(q.vy,q.vx));ctx.fillRect(-8,-2,16,4)}else{ctx.beginPath();ctx.arc(0,0,q.r,0,TAU);ctx.fill()}ctx.restore();}}
  function drawGems(){for(const g of gems){const p=worldToScreen(g.x,g.y),s=1+Math.sin(g.t*8)*.12;ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);ctx.rotate(Math.PI/4);ctx.fillStyle='#72e6bc';ctx.shadowColor='#72e6bc';ctx.shadowBlur=10;ctx.fillRect(-g.r,-g.r,g.r*2,g.r*2);ctx.restore();}}
  function drawPickups(){for(const x of pickups){const p=worldToScreen(x.x,x.y);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#ec6975';ctx.shadowColor='#ec6975';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(0,0,9,0,TAU);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-2,-5,4,10);ctx.fillRect(-5,-2,10,4);ctx.restore();}}
  function drawParticles(){for(const x of particles){const p=worldToScreen(x.x,x.y);ctx.globalAlpha=clamp(x.life/(x.max||.5),0,1);ctx.fillStyle=x.c;ctx.beginPath();ctx.arc(p.x,p.y,x.r,0,TAU);ctx.fill()}ctx.globalAlpha=1}
  function drawFloaters(){for(const f of floaters){const p=worldToScreen(f.x,f.y);ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.c;ctx.font=`900 ${f.size}px system-ui`;ctx.textAlign='center';ctx.fillText(f.text,p.x,p.y)}ctx.globalAlpha=1}
  function drawVignette(){const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.7);g.addColorStop(0,'transparent');g.addColorStop(1,'#00000070');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}

  function updateHUD(){
    if(!player)return; ui.levelText.textContent=player.level; const hp=clamp(player.hp/player.maxHp,0,1);ui.hpFill.style.width=(hp*100)+'%';ui.hpText.textContent=`${Math.ceil(Math.max(0,player.hp))} / ${Math.ceil(player.maxHp)}`;
    const xp=clamp(player.xp/player.xpNeed,0,1);ui.xpFill.style.width=(xp*100)+'%';ui.xpText.textContent=`${Math.floor(player.xp)} / ${player.xpNeed} XP`;ui.goldText.textContent=fmt(player.gold);ui.shardText.textContent=fmt(player.shards);ui.potionText.textContent=player.potions;ui.classIcon.textContent=CLASS_DATA[player.classId].icon;
    ui.zoneText.textContent=`${ZONES[player.zoneIndex].name} · ${player.stage}`;ui.objectiveText.textContent=bossAlive?'Defeat the Rift Warden':`${Math.min(stageKills,stageTarget)} / ${stageTarget} enemies`;
    const d=player.dashTimer,s=player.skillTimer;ui.dashBtn.classList.toggle('cooldown',d>0);ui.skillBtn.classList.toggle('cooldown',s>0);ui.dashText.textContent=d>0?d.toFixed(1):'DASH';ui.skillText.textContent=s>0?s.toFixed(1):CLASS_DATA[player.classId].skill.toUpperCase();
  }

  function renderMenu(){
    const c=CLASS_DATA[player.classId];ui.heroName.textContent=c.name;
    ui.tabStats.innerHTML=`<div class="stat-grid"><div class="stat"><small>Power</small><strong>${Math.round(player.damage)}</strong></div><div class="stat"><small>Max HP</small><strong>${Math.round(player.maxHp)}</strong></div><div class="stat"><small>Attack speed</small><strong>${(1/player.attackRate).toFixed(2)}/s</strong></div><div class="stat"><small>Critical</small><strong>${Math.round(player.critChance*100)}%</strong></div><div class="stat"><small>Move speed</small><strong>${Math.round(player.speed)}</strong></div><div class="stat"><small>Damage resist</small><strong>${Math.round(player.damageReduction*100)}%</strong></div></div>`;
    ui.tabGear.innerHTML='<div class="gear-list">'+['weapon','armor','charm'].map(slot=>{const g=save.gear[slot],ic=slot==='weapon'?'⚔':slot==='armor'?'⬢':'◇';return `<div class="gear-row"><div class="gear-icon">${ic}</div><div><strong class="${g?'rarity-'+g.rarity:''}">${g?g.name:'Empty '+slot}</strong><small>${g?gearDesc(g):'Defeat bosses to find gear.'}</small></div><span>${g?'Lv '+g.level:'—'}</span></div>`}).join('')+'</div>';
    const m=save.mastery, shard=player.shards;ui.tabMastery.innerHTML=[['might','Might','+5% damage per rank'],['vigor','Vigor','+5% max HP per rank'],['fortune','Fortune','+8% gold per rank']].map(([id,n,d])=>{const cost=2+(m[id]||0)*2;return `<div class="mastery-box"><header><strong>${n} · ${m[id]||0}</strong><span>✦ ${cost}</span></header><p>${d}</p><button data-mastery="${id}" ${shard<cost?'disabled':''}>UPGRADE</button></div>`}).join('');
    $$('[data-mastery]').forEach(b=>b.onclick=()=>{const id=b.dataset.mastery,cost=2+(save.mastery[id]||0)*2;if(player.shards<cost)return;player.shards-=cost;save.mastery[id]++;const pct=player.hp/player.maxHp;applyDerived(player);player.hp=Math.min(player.maxHp,player.maxHp*pct);persist();renderMenu();updateHUD();});
  }

  function openMenu(){if(paused)return;paused=true;renderMenu();ui.menu.classList.remove('hidden')}
  function closeMenu(){ui.menu.classList.add('hidden');paused=false}

  function loop(now){
    if(!running)return;const dt=Math.min(.033,(now-last)/1000||.016);last=now;if(!paused)update(dt);draw();requestAnimationFrame(loop);
  }

  // Input
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if(k===' ')dash();if(k==='e')skill();if(k==='q')usePotion();if(k==='escape'&&!ui.menu.classList.contains('hidden'))closeMenu();});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  function joystickPos(ev){const r=ui.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=ev.clientX-cx,dy=ev.clientY-cy,d=Math.hypot(dx,dy),max=r.width*.34,n=Math.min(d,max),nx=d?dx/d:0,ny=d?dy/d:0;joy.x=nx*(n/max);joy.y=ny*(n/max);joy.mag=n/max;ui.stick.style.transform=`translate(${nx*n}px,${ny*n}px)`;}
  ui.joystick.addEventListener('pointerdown',e=>{joy.active=true;joy.id=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);joystickPos(e)});
  ui.joystick.addEventListener('pointermove',e=>{if(joy.active&&e.pointerId===joy.id)joystickPos(e)});
  function endJoy(e){if(e.pointerId!==joy.id)return;joy.active=false;joy.x=joy.y=joy.mag=0;ui.stick.style.transform='translate(0,0)'}
  ui.joystick.addEventListener('pointerup',endJoy);ui.joystick.addEventListener('pointercancel',endJoy);
  ui.dashBtn.onclick=dash;ui.skillBtn.onclick=skill;ui.potionBtn.onclick=usePotion;ui.menuBtn.onclick=openMenu;ui.closeMenuBtn.onclick=closeMenu;
  $$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.toggle('active',x===t));$$('.tab-content').forEach(x=>x.classList.remove('active'));$('#tab'+t.dataset.tab[0].toUpperCase()+t.dataset.tab.slice(1)).classList.add('active')});

  ui.newGameBtn.onclick=()=>{save=null;ui.title.classList.add('hidden');ui.classes.classList.remove('hidden')};
  ui.continueBtn.onclick=()=>{save=load();if(save)startGame(true)};
  ui.classBackBtn.onclick=()=>{ui.classes.classList.add('hidden');ui.title.classList.remove('hidden')};
  $$('.class-card').forEach(b=>b.onclick=()=>{save=freshSave(b.dataset.class);localStorage.setItem(STORAGE,JSON.stringify(save));startGame(true)});
  ui.reviveBtn.onclick=returnCamp;ui.deathMenuBtn.onclick=title;
  addEventListener('beforeunload',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();visibilityPaused=running&&!paused;if(visibilityPaused)paused=true}else if(visibilityPaused){visibilityPaused=false;if(running)paused=false}});

  // PWA installation
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;ui.installBtn.classList.remove('hidden')});
  ui.installBtn.onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;ui.installBtn.classList.add('hidden')};
  if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

  save=load();ui.continueBtn.classList.toggle('hidden',!save);drawTitleBackdrop();
})();

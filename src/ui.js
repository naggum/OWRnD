// src/ui.js
import { game, formatTime } from './game.js';
import { startBossBattle } from './systems/boss.js';

export function setupUI(onRestart){
  document.getElementById('restart').onclick = ()=>onRestart();
  updateStatsDisplay();
}

export function maybeLevelUp(){
  let leveledUpThisCall = false; // 이 호출에서 레벨업이 발생했는지 추적

  while(game.player.xp >= game.player.xpNext){
    game.player.xp -= game.player.xpNext;
    game.player.level++; game.player.xpNext = Math.round(game.player.xpNext*1.28 + 10);
    game.levelsToDistribute++; // 레벨업 횟수 증가
    leveledUpThisCall = true;

    // 보스전 시작 로직
    const isBossLevel = game.player.level === 5 || (game.player.level > 5 && (game.player.level - 5) % 8 === 0);
    if (isBossLevel && game.player.level > (game.lastBossLevel || 0)) {
      game.bossCount++;
      startBossBattle();
      game.lastBossLevel = game.player.level;
    }
  }

  // 레벨업이 발생했고, 현재 레벨업 화면이 열려있지 않으면 스킬 선택지 표시
  if (leveledUpThisCall && !document.getElementById('levelup').classList.contains('show')) {
    // 레벨업 시 모든 적에게 현재 체력의 50% 데미지
    for (const e of game.enemies) {
      e.hp *= 0.5;
    }

    // 이펙트 활성화
    game.levelUpFx.active = true;
    game.levelUpFx.progress = 0;
    game.shake = 15;

    openLevelUp(); // 실제 스킬 선택지 UI를 여는 함수 호출
  }

  if(!game.running && game.player.hp<=0){
    showGameOver();
  }
}

export function openLevelUp(){
  game.running=false;
  const pool = [
    {name:"공격력 +30%", apply:()=>game.player.dmg*=1.3, desc:"+30% 피해"},
    {name:"쿨다운 -30%", apply:()=>game.player.cooldown*=0.7, desc:"자동 사격 주기 30% 단축"},
    game.player.hasSpiralRocket
      ? {name:"나선로켓 레벨업", apply:()=>{game.player.spiralRocketDmgMultiplier*=1.2;}, desc:"나선로켓의 데미지 20% 증가"}
      : {name:"나선로켓 획득", apply:()=>{game.player.hasSpiralRocket=true; game.player.spiralRocketCharge=0;}, desc:"기본공격 5번마다 2개의 나선 로켓(기본 데미지 4배) 발사"},
    {name:"이동속도 +20%", apply:()=>game.player.speed*=1.2, desc:"기본 이동속도 20% 증가"},
    {name:"최대 체력 +20%", apply:()=>{game.player.maxHp=Math.round(game.player.maxHp*1.2); game.player.hp=game.player.maxHp;}, desc:"회복 포함"},
    game.player.biofield ? {name:"생체장 레벨업", apply:()=>{game.player.biofieldCooldown=Math.max(1, game.player.biofieldCooldown-0.5);}, desc:`쿨타임 ${game.player.biofieldCooldown.toFixed(1)}초 → ${(game.player.biofieldCooldown - 0.5).toFixed(1)}초`}
                         : {name:"생체장 획득", apply:()=>{game.player.biofield=true; game.player.biofieldTimer=0;}, desc:"주기적으로 10초간 체력 회복(초당 1%)"},
  ];
  const choices = [];
  const tmp=[...pool];
  while(choices.length<3 && tmp.length){
    const idx = Math.floor(Math.random()*tmp.length);
    choices.push(tmp.splice(idx,1)[0]);
  }
  const wrap = document.getElementById('choices');
  wrap.innerHTML='';
  for(const c of choices){
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<h3>★ ${c.name}</h3><p>${c.desc}</p>`;
    d.onclick=()=>{
      c.apply();
      updateStatsDisplay(); // 스탯 정보 업데이트
      game.levelsToDistribute--;
      if (game.levelsToDistribute > 0) {
        openLevelUp(); // 아직 선택할 레벨업이 남아있으면 다시 호출
      } else {
        game.running=true;
        document.getElementById('levelup').classList.remove('show');
      }
    };
    wrap.appendChild(d);
  }
  document.getElementById('levelup').classList.add('show');
}

export function showGameOver(){
  document.getElementById('summary').textContent =
    `생존 시간 ${formatTime(game.elapsed)} · 레벨 ${game.player.level} · 처치 ${game.kills}회`;
  document.getElementById('gameover').classList.add('show');
}

export function updateStatsDisplay(){
  const statsDisplay = document.getElementById('stats-display');
  if (!statsDisplay) return;

  let statsHtml = ``;
  statsHtml += `<p>공격력: <b>${(game.player.dmg).toFixed(1)}</b></p>`;
  statsHtml += `<p>이동속도: <b>${game.player.speed.toFixed(1)}</b></p>`;

  if (game.player.hasSpiralRocket) {
    const spiralDmgMultiplierDisplay = (game.player.spiralRocketDmgMultiplier * 100).toFixed(0);
    statsHtml += `<p>나선로켓: <b>${spiralDmgMultiplierDisplay}% 피해</b></p>`;
  } else {
    statsHtml += `<p>나선로켓: <b>획득 전</b></p>`;
  }

  if (game.player.biofield) {
    statsHtml += `<p>생체장: <b>쿨타임 ${game.player.biofieldCooldown.toFixed(1)}초</b></p>`;
  } else {
    statsHtml += `<p>생체장: <b>획득 전</b></p>`;
  }

  // 전술 조준경 정보
  if (game.player.hasTacticalScope) {
    if (game.player.isTacticalScopeActive) {
      statsHtml += `<p>전술 조준경: <b>활성화 중 (${game.player.tacticalScopeDuration.toFixed(1)}초 남음)</b></p>`;
    } else if (game.player.tacticalScopeCooldown > 0) {
      statsHtml += `<p>전술 조준경: <b>쿨타임 (${game.player.tacticalScopeCooldown.toFixed(1)}초)</b></p>`;
    } else {
      statsHtml += `<p>전술 조준경: <b>사용 가능</b></p>`;
    }
  } else {
    statsHtml += `<p>전술 조준경: <b>획득 전</b></p>`;
  }

  statsDisplay.innerHTML = statsHtml;
}

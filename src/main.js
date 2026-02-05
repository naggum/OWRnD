// src/main.js
import { game, resizeCanvas, drawScene, updateHUD, formatTime, resetGame } from './game.js';
import { spawnEnemy, updateEnemies } from './systems/spawner.js';
import { shootIfReady, updateBullets, circleHit, tacticalScopeAttack } from './systems/combat.js';
import { maybeLevelUp, showGameOver, setupUI, updateStatsDisplay } from './ui.js';
import { updateBoss, updateBossBullets, drawBoss, drawBossBullets, updateGrenades, drawGrenades, spawnGrenadesRandomly } from './systems/boss.js'; // 보스 시스템, 수류탄, 수류탄 스폰 임포트

// 캔버스 리사이즈
addEventListener('resize', resizeCanvas);
resizeCanvas();

// 입력
const keys = { w:false, a:false, s:false, d:false };

function activateUltimate() {
  if(game.player.hasTacticalScope && !game.player.isTacticalScopeActive && game.player.tacticalScopeCooldown <= 0){
    game.player.isTacticalScopeActive = true;
    game.player.tacticalScopeDuration = game.player.tacticalScopeMaxDuration;
    // 스탯 버프 적용을 위한 초기화
    game.player.originalSpeed = game.player.speed;
    game.player.originalCooldown = game.player.cooldown;
    game.player.originalDmg = game.player.dmg;

    game.player.speed *= 2; // 100% 증가
    game.player.cooldown /= 3; // 200% 증가 (1/3로 단축)
    game.player.dmg *= 1.5; // 50% 증가
    game.ultimateMessage.text = '목표를 포착했다.';
    game.ultimateMessage.duration = 3;
    updateStatsDisplay(); // 스탯 디스플레이 업데이트
  }
}

addEventListener('keydown', e => {
  if(e.code==='KeyW')keys.w=true;
  if(e.code==='KeyA')keys.a=true;
  if(e.code==='KeyS')keys.s=true;
  if(e.code==='KeyD')keys.d=true;
  if(e.code==='KeyQ'){ // 'Q' 키로 궁극기 활성화
    activateUltimate();
  }
});
addEventListener('keyup',   e => { if(e.code==='KeyW')keys.w=false; if(e.code==='KeyA')keys.a=false; if(e.code==='KeyS')keys.s=false; if(e.code==='KeyD')keys.d=false; });

// 모바일 스틱
const stick = document.getElementById('stick');
const knob  = document.getElementById('knob');
let stickVec = {x:0,y:0};
(function setupStick(){
  let dragging=false;

  function move(e) {
    if (!dragging) return;
    e.preventDefault();

    const r = stick.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    
    let vx = t.clientX - cx;
    let vy = t.clientY - cy;

    const L = Math.hypot(vx, vy) || 1;
    const m = Math.min(40, L);

    vx = vx / L * m;
    vy = vy / L * m;

    knob.style.left = (60 + vx - 25) + 'px';
    knob.style.top = (60 + vy - 25) + 'px';

    stickVec.x = vx / 40;
    stickVec.y = vy / 40;
  }

  function onPointerUp(e) {
    dragging = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp); // Also handle cancel events

    knob.style.left = '35px';
    knob.style.top = '35px';
    stickVec.x = 0;
    stickVec.y = 0;
  }

  stick.addEventListener('pointerdown', e => {
    dragging = true;
    e.preventDefault();
    
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp); // Handle cases where the touch is interrupted

    move(e);
  });
})();

// 모바일 궁극기 버튼
const ultimateBtn = document.getElementById('ultimate-btn');
ultimateBtn.addEventListener('click', activateUltimate);

// UI(레벨업/리스타트) 초기화
setupUI(resetGame);

// 게임 시작
resetGame();

// 메인 루프
function loop(ts){
  requestAnimationFrame(loop);
  const t = performance.now();
  let dt = (t - game.last)/1000; game.last=t;
  if(dt>0.05) dt=0.05;

  // 이펙트 업데이트
  if (game.levelUpFx.active) {
    game.levelUpFx.progress += dt * 2; // 0.5초 동안 지속
    if (game.levelUpFx.progress >= 1) {
      game.levelUpFx.active = false;
      game.levelUpFx.progress = 0;
    }
  }
  if (game.shake > 0) {
    game.shake *= 0.92; // 감쇠
    if (game.shake < 0.5) game.shake = 0;
  }

  // 파티클 업데이트
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      game.particles.splice(i, 1);
      continue;
    }
    p.vx *= 0.97; // 감속
    p.vy *= 0.97;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if(!game.running){ drawScene(); return; }

  // 시간/난이도
  game.elapsed += dt; game.diff += dt*0.20;
  if(game.player.invuln>0) game.player.invuln-=dt;

  // 전술 조준경 궁극기 업데이트
  if (game.player.isTacticalScopeActive) {
    game.player.tacticalScopeDuration -= dt;
    // 궁극기 효과 (공격)는 combat.js에서 처리
          game.player.tacticalScopeAttackTimer -= dt;
        if (game.player.tacticalScopeAttackTimer <= 0) {
          tacticalScopeAttack(dt); // 공격 로직 호출
          game.player.tacticalScopeAttackTimer = game.player.tacticalScopeAttackInterval;
        }
    if (game.player.tacticalScopeDuration <= 0) {
      // 궁극기 종료
      game.player.isTacticalScopeActive = false;
      game.player.tacticalScopeCooldown = game.player.tacticalScopeMaxCooldown;
      // 스탯 원상복구
      game.player.speed = game.player.originalSpeed;
      game.player.cooldown = game.player.originalCooldown;
      game.player.dmg = game.player.originalDmg;
      updateStatsDisplay();
    }
  } else {
    // 궁극기 쿨다운 감소
    if (game.player.tacticalScopeCooldown > 0) {
      game.player.tacticalScopeCooldown -= dt;
      if (game.player.tacticalScopeCooldown < 0) {
        game.player.tacticalScopeCooldown = 0;
        updateStatsDisplay(); // 쿨다운 종료 시 디스플레이 업데이트
      }
    }
  }
  
  // 궁극기 버튼 UI 업데이트
  if (game.player.hasTacticalScope) {
    ultimateBtn.style.display = 'flex'; // 스코프 획득 시 버튼 표시
    if (game.player.tacticalScopeCooldown > 0) {
      ultimateBtn.style.opacity = '0.5';
      ultimateBtn.textContent = `${Math.ceil(game.player.tacticalScopeCooldown)}`;
    } else {
      ultimateBtn.style.opacity = '1';
      ultimateBtn.textContent = '궁극기';
    }
  } else {
    ultimateBtn.style.display = 'none'; // 스코프 미보유 시 버튼 숨김
  }


  // 이동 입력
  let vx = (keys.d?1:0) - (keys.a?1:0) + stickVec.x;
  let vy = (keys.s?1:0) - (keys.w?1:0) + stickVec.y;
  const L = Math.hypot(vx,vy);
  if(L>0){
    vx/=L; vy/=L;
    game.player.vx = vx * game.player.speed; // 플레이어 현재 속도 저장
    game.player.vy = vy * game.player.speed;
  } else {
    game.player.vx = 0;
    game.player.vy = 0;
  }

  // 플레이어 방향 업데이트
  if (vx > 0) game.player.direction = 1;
  else if (vx < 0) game.player.direction = -1;

  // 애니메이션
  game.player.moving = (vx !== 0 || vy !== 0);
  if (game.player.moving) {
    game.player.animationTimer += dt;
    if (game.player.animationTimer > 0.1) { // 10fps
      game.player.frame = (game.player.frame + 1) % 8;
      game.player.animationTimer = 0;
    }
  } else {
    game.player.frame = 0;
  }

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  game.player.x = clamp(game.player.x + vx*game.player.speed*dt, 0, game.W);
  game.player.y = clamp(game.player.y + vy*game.player.speed*dt, 0, game.H);

  // 궁극기 메시지 타이머 업데이트
  if (game.ultimateMessage.duration > 0) {
    game.ultimateMessage.duration -= dt;
  }

  // 전투 처리
  shootIfReady(dt);
  updateBullets(dt);

  // 보스전 업데이트
  if(game.isBossBattle){
    updateBoss(dt);
    updateBossBullets(dt);
    updateGrenades(dt);
    spawnGrenadesRandomly(dt); // 수류탄 무작위 스폰
  }

  // 생체장 스킬
  if (game.player.biofield) {
    if (game.player.biofieldDuration <= 0) { // 비활성 (쿨다운)
      game.player.biofieldTimer -= dt;
      if (game.player.biofieldTimer <= 0) {
        game.player.biofieldDuration = 10; // 10초간 활성화
      }
    } else { // 활성 (힐링)
      game.player.biofieldDuration -= dt;
      const healAmount = game.player.maxHp * 0.01 * dt;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + healAmount);

      if (game.player.biofieldDuration <= 0) {
        game.player.biofieldTimer = game.player.biofieldCooldown; // 쿨다운 시작
      }
    }
  }

  // 적 스폰/이동/충돌
  spawnEnemy(dt);
  updateEnemies(dt);

  // 픽업 이동/자력/획득
  for(let i=game.pickups.length-1;i>=0;i--){
    const p=game.pickups[i];
    p.vx*=0.96; p.vy*=0.96; p.x+=p.vx*dt; p.y+=p.vy*dt;
    const d=Math.hypot(p.x-game.player.x,p.y-game.player.y);
    if(d<160){
      const a=Math.atan2(game.player.y-p.y, game.player.x-p.x);
      p.x += Math.cos(a)*200*dt*(1-d/160);
      p.y += Math.sin(a)*200*dt*(1-d/160);
    }
    if(circleHit({x:game.player.x,y:game.player.y,r:16}, p)){
      if(p.type==='xp'){ game.player.xp += p.value; }
      else { game.player.hp = Math.min(game.player.maxHp, game.player.hp + p.value); }
      game.pickups.splice(i,1);
    }
  }

  // 레벨업 체크(일시정지 포함)
  maybeLevelUp();

  // HUD/렌더
  updateHUD();
  drawScene(); // 일반 게임 요소를 그리는 함수

  // 보스 그리기
  if(game.isBossBattle && game.boss){
    drawBoss(); // drawBoss는 이제 ctx를 직접 임포트해서 사용
    drawBossBullets(); // drawBossBullets는 이제 ctx를 직접 임포트해서 사용
    drawGrenades(); // 수류탄 그리기
  }
}
requestAnimationFrame(loop);

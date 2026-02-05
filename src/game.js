// src/game.js
export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

const playerSprite = new Image();
playerSprite.src = 'asset/run_sprite.png';

const enemySprite = new Image();
enemySprite.src = 'asset/Omic_1.png';

export const bossSprite = new Image();
bossSprite.src = 'asset/boss_1.png';

export const spiralRocketSprite = new Image();
spiralRocketSprite.src = 'asset/Rocket.png';

export const biofieldSprite = new Image();
biofieldSprite.src = 'asset/biofield.png';

export const game = {
  running:false, last:performance.now(), elapsed:0, diff:0,
  W:0, H:0, DPR:window.devicePixelRatio||1,
  enemies:[], bullets:[], pickups:[], particles:[], bossBullets:[], grenades:[],
  kills:0,
  isBossBattle: false,
  boss: null,
  levelsToDistribute: 0,
  ultimateMessage: { text: '', duration: 0 },
  player:{
    x:0, y:0, r:14, speed:220,
    maxHp:120, hp:120, dmg:10,
    cooldown:0.33, projPerShot:1, shootTimer:0,
    hasSpiralRocket:false, spiralRocketCharge:0, spiralRocketDmgMultiplier:1,
    biofield:false, biofieldCooldown:5, biofieldTimer:0, biofieldDuration:0,
    hasTacticalScope:true, tacticalScopeCooldown:0, tacticalScopeMaxCooldown:30, tacticalScopeDuration:0, tacticalScopeMaxDuration:8, isTacticalScopeActive:false, tacticalScopeAttackTimer:0, tacticalScopeAttackInterval:0.05,
    originalSpeed:220, originalCooldown:0.33, originalDmg:10,
    xp:0, level:1, xpNext:30, invuln:0, vx:0, vy:0,
    frame: 0, animationTimer: 0, moving: false, direction: 1,
  },
  spawnTimer:0, spawnRate:1.82,
  levelUpFx: { active: false, progress: 0 },
  shake: 0,
};

export function resizeCanvas(){
  game.W = window.innerWidth; game.H = window.innerHeight;
  game.DPR = window.devicePixelRatio || 1;
  canvas.style.width = game.W+'px'; canvas.style.height = game.H+'px';
  canvas.width = Math.floor(game.W * game.DPR); canvas.height = Math.floor(game.H * game.DPR);
  ctx.setTransform(game.DPR,0,0,game.DPR,0,0);
}

export function resetGame(){
  game.player.x = game.W/2; game.player.y = game.H/2;
  Object.assign(game.player, {
    r:14, speed:220, maxHp:120, hp:120, dmg:10,
    cooldown:0.33, projPerShot:1, shootTimer:0,
    hasSpiralRocket:false, spiralRocketCharge:0, spiralRocketDmgMultiplier:1,
    biofield:false, biofieldCooldown:5, biofieldTimer:0, biofieldDuration:0,
    hasTacticalScope:true, tacticalScopeCooldown:0, tacticalScopeMaxCooldown:30, tacticalScopeDuration:0, tacticalScopeMaxDuration:8, isTacticalScopeActive:false, tacticalScopeAttackTimer:0, tacticalScopeAttackInterval:0.05,
    originalSpeed:220, originalCooldown:0.33, originalDmg:10,
    xp:0, level:1, xpNext:30, invuln:0, vx:0, vy:0,
    frame: 0, animationTimer: 0, moving: false, direction: 1,
  });
  game.elapsed=0; game.diff=0; game.kills=0;
  game.spawnTimer=0; game.spawnRate=1.82;
  game.enemies.length=0; game.bullets.length=0; game.pickups.length=0; game.particles.length=0; game.bossBullets.length=0; game.grenades.length=0;
  game.isBossBattle = false; game.boss = null; game.levelsToDistribute = 0; game.ultimateMessage = { text: '', duration: 0 };
  game.running=true; document.getElementById('gameover').classList.remove('show');
  document.getElementById('levelup').classList.remove('show');
  game.last = performance.now();
}

export function formatTime(s){ const m=Math.floor(s/60), ss=Math.floor(s%60); return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }

export function updateHUD(){
  document.getElementById('time').textContent = formatTime(game.elapsed);
  document.getElementById('level').textContent = game.player.level;
  document.getElementById('hpbar').style.width = (game.player.hp/game.player.maxHp*100)+'%';
  document.getElementById('xpbar').style.width = (game.player.xp/game.player.xpNext*100)+'%';
  document.getElementById('enemies').textContent = game.enemies.length;
}

export function drawScene(){
  ctx.save();
  if (game.shake > 0) {
    const sx = (Math.random() - 0.5) * game.shake;
    const sy = (Math.random() - 0.5) * game.shake;
    ctx.translate(sx, sy);
  }

  const g=48;
  ctx.clearRect(0,0,game.W,game.H);
  ctx.fillStyle='#0f1420'; ctx.fillRect(0,0,game.W,game.H);
  ctx.strokeStyle='#121a2a'; ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=((game.player.x%g)+g)%g; x<game.W; x+=g){ ctx.moveTo(x,0); ctx.lineTo(x,game.H); }
  for(let y=((game.player.y%g)+g)%g; y<game.H; y+=g){ ctx.moveTo(0,y); ctx.lineTo(game.W,y); }
  ctx.stroke();

  // 파티클
  for(const p of game.particles){
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r*2, p.r*2);
    ctx.globalAlpha = 1;
  }

  // 픽업
  for(const p of game.pickups){
    ctx.fillStyle = p.type==='xp' ? '#21c8ff' : '#ffcc55';
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }

  // 적
  for(const e of game.enemies){
    const frameX = (e.frame || 0) * 30;
    const spriteW = 30;
    const spriteH = 30;
    ctx.drawImage(
      enemySprite,
      frameX, 0, spriteW, spriteH,
      e.x - spriteW/2, e.y - spriteH/2, spriteW, spriteH
    );
  }

    ctx.restore(); // 저장된 canvas 상태 복원

    // 생체장 스킬 이미지 및 이펙트
    if (game.player.biofield) {
      const biofieldSize = 20; // 20x20 픽셀 (기존 40x40의 절반)
      // 플레이어의 왼쪽에 배치 (겹치지 않게, 5픽셀 추가 여유)
      const drawX = game.player.x - game.player.r - biofieldSize - 5;
      const drawY = game.player.y - biofieldSize / 2;

      ctx.drawImage(
        biofieldSprite,
        0, 0, biofieldSprite.width, biofieldSprite.height, // 전체 스프라이트 사용
        drawX, drawY, biofieldSize, biofieldSize
      );

      // 생체장 회복 이펙트 (활성화 시)
      if (game.player.biofieldDuration > 0) {
        const healProgress = game.player.biofieldDuration / 10; // 10초 지속
        const alpha = Math.sin(healProgress * Math.PI) * 0.2; // 부드럽게 깜빡임
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#6eff7f'; // 녹색 힐링 컬러
        ctx.beginPath();
        ctx.arc(game.player.x, game.player.y, 50, 0, Math.PI * 2); // 플레이어 주위에 그리기 (크기 2배)
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

  // 플레이어
  if (game.player.invuln > 0 && Math.floor(game.player.invuln * 10) % 2 === 0) {
    // 무적 상태일 때 깜빡임 효과 (아무것도 그리지 않음)
  } else {
    ctx.save(); // 현재 canvas 상태 저장

    // 플레이어 방향에 따라 반전
    if (game.player.direction === -1) {
      ctx.translate(game.player.x, game.player.y); // 플레이어 위치로 이동
      ctx.scale(-1, 1); // x축 반전
      ctx.translate(-game.player.x, -game.player.y); // 다시 원위치로 이동 (반전된 상태에서)
    }

    const frameX = game.player.frame * 120;
    ctx.drawImage(
      playerSprite,
      frameX, 0, 120, 120, // source rect
      game.player.x - 30, game.player.y - 30, 60, 60 // destination rect
    );

    ctx.restore(); // 저장된 canvas 상태 복원

    // 궁극기 메시지 표시
    if (game.ultimateMessage.duration > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, game.ultimateMessage.duration / 0.5); // 마지막 0.5초 동안 투명도 조절
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(game.ultimateMessage.text, game.player.x, game.player.y - game.player.r - 30); // 플레이어 머리 위 (높이 조정)
      ctx.restore();
    }
  }

  // 총알
  for(const b of game.bullets){
    if (b.isSpiral) {
      ctx.save(); // 현재 캔버스 상태 저장

      // 로켓의 중심점으로 이동
      ctx.translate(b.x, b.y);

      // 로켓의 이동 방향에 따라 회전 (오른쪽이 0도 기준)
      const angle = Math.atan2(b.vy, b.vx);
      ctx.rotate(angle);

      // 스프라이트 그리기 (회전된 상태에서 중심을 기준으로 그림)
      const spriteW = b.r * 2; // 총알 반지름에 맞춰 크기 조정
      const spriteH = b.r * 2;
      ctx.drawImage(
        spiralRocketSprite,
        0, 0, spiralRocketSprite.width, spiralRocketSprite.height, // 전체 스프라이트 사용
        -spriteW / 2, -spriteH / 2, spriteW, spriteH // 중심을 기준으로 그리기
      );

      ctx.restore(); // 캔버스 상태 복원 (회전 되돌리기)
    } else {
      ctx.fillStyle = b.color || '#aef';
      ctx.beginPath();
      ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
      ctx.fill();
    }
  }

  // 레벨업 이펙트
  if (game.levelUpFx.active) {
    const prog = game.levelUpFx.progress;
    const maxRadius = Math.min(game.W, game.H) * 0.7;
    const easedProgress = Math.sin(prog * Math.PI);
    const radius = easedProgress * maxRadius;
    const alpha = 1.0 - prog;
    ctx.strokeStyle = `rgba(170, 230, 255, ${alpha})`;
    ctx.lineWidth = easedProgress * 8;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

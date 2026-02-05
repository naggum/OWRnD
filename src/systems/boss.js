// src/systems/boss.js
import { game, ctx, bossSprite } from '../game.js';
import { circleHit, createExplosion } from '../systems/combat.js';

const rand=(a,b)=>Math.random()*(b-a)+a;

export function startBossBattle(){
  game.isBossBattle = true;
  game.enemies.length = 0; // 기존 적 제거

  game.boss = {
    x: game.W / 2,
    y: -100,
    r: 60, // 120x120 픽셀
    hp: 3000,
    maxHp: 3000,
    spd: 130,
    targetX: game.W / 2,
    targetY: -100,
    moveTimer: 0,
    shootTimer: 2, // 첫 발사 쿨다운
    evadeCooldown: 0,
    frame: 0, animationTimer: 0, direction: 1, // 스프라이트 애니메이션 및 방향
    phase: 'entering', // entering, fighting, defeated
  };
}

export function updateBoss(dt) {
  if (!game.isBossBattle || !game.boss) return;
  const boss = game.boss;

  // --- PHASES ---
  if (boss.phase === 'entering') {
    boss.y += 60 * dt;
    if (boss.y >= 120) {
      boss.y = 120;
      boss.phase = 'fighting';
    }
    return; // 등장 중에는 다른 행동 안함
  }

  if (boss.phase !== 'fighting') return;

  // --- MOVEMENT ---
  boss.moveTimer -= dt;
  if (boss.moveTimer <= 0 || (Math.hypot(boss.x - boss.targetX, boss.y - boss.targetY) < boss.r)) {
    // 새 목표 지점 설정 (화면 내에서 무작위)
    boss.targetX = rand(boss.r + 20, game.W - boss.r - 20);
    boss.targetY = rand(boss.r + 20, game.H / 2 - boss.r - 20); // 화면 상단 절반에서만 움직이도록
    boss.moveTimer = rand(3, 6); // 3~6초마다 목표 변경
  }

  // 목표를 향해 이동
  const angleToTarget = Math.atan2(boss.targetY - boss.y, boss.targetX - boss.x);
  const prevX = boss.x;
  boss.x += Math.cos(angleToTarget) * boss.spd * dt;
  boss.y += Math.sin(angleToTarget) * boss.spd * dt;

  // 보스 방향 업데이트 (좌우 움직임에 따라)
  if (boss.x > prevX) boss.direction = 1;
  else if (boss.x < prevX) boss.direction = -1;

  // 애니메이션 업데이트
  boss.animationTimer += dt;
  if (boss.animationTimer >= 0.1) { // 10fps
    boss.frame = (boss.frame + 1) % 8; // 8 프레임 애니메이션
    boss.animationTimer = 0;
  }

  // 화면 경계 유지
  boss.x = Math.max(boss.r, Math.min(game.W - boss.r, boss.x));
  boss.y = Math.max(boss.r, Math.min(game.H - boss.r, boss.y));

  // --- EVASION ---
  boss.evadeCooldown -= dt;
  if (boss.evadeCooldown <= 0) {
    for (const b of game.bullets) {
      const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (dist < boss.r + 40) { // 회피 반경 (조정)
        const dodgeAngle = Math.atan2(b.y - boss.y, b.x - boss.x) + Math.PI/2 + rand(-0.5,0.5); // 총알에 수직 방향으로 회피
        boss.x += Math.cos(dodgeAngle) * 200 * dt; // 빠르게 이동
        boss.y += Math.sin(dodgeAngle) * 200 * dt;
        boss.evadeCooldown = 0.5; // 0.5초 쿨다운
        break;
      }
    }
  }
  // 회피 후 화면 경계 다시 확인
  boss.x = Math.max(boss.r, Math.min(game.W - boss.r, boss.x));
  boss.y = Math.max(boss.r, Math.min(game.H - boss.r, boss.y));


  // --- SHOOTING ---
  boss.shootTimer -= dt;
  if (boss.shootTimer <= 0) {
    boss.shootTimer = rand(0.8, 1.5); // 재장전 시간 랜덤화
    // 탄막 발사
    const bulletCount = rand(15,25); // 총알 개수 랜덤화
    const startAngle = rand(0, Math.PI * 2); // 시작 각도 랜덤화
    for (let i = 0; i < bulletCount; i++) {
      const angle = startAngle + (Math.PI * 2 / bulletCount) * i + rand(-0.05, 0.05); // 약간의 무작위성
      const spd = rand(150, 250); // 속도 랜덤화
      game.bossBullets.push({
        x: boss.x, y: boss.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r: 8,
        life: 4,
        color: '#ff6633'
      });
    }
  }

  // --- GRENADE ATTACK ---

}

export function updateBossBullets(dt) {
  for (let i = game.bossBullets.length - 1; i >= 0; i--) {
    const b = game.bossBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -30 || b.x > game.W + 30 || b.y < -30 || b.y > game.H + 30) {
      game.bossBullets.splice(i, 1);
      continue;
    }

    // 플레이어와 충돌
    if (game.player.invuln <= 0 && circleHit(b, game.player)) {
      game.player.hp -= 20;
      game.player.invuln = 0.6;
      game.bossBullets.splice(i, 1);
      if (game.player.hp <= 0) {
        game.player.hp = 0;
        game.running = false;
      }
    }
  }
}

export function drawBoss() {
  if (!game.isBossBattle || !game.boss) return;
  const boss = game.boss;

  // Boss Body (스프라이트 그리기)
  ctx.save(); // 현재 캔버스 상태 저장

  // 보스 방향에 따라 반전
  if (boss.direction === -1) {
    ctx.translate(boss.x, boss.y); // 보스 위치로 이동
    ctx.scale(-1, 1); // x축 반전
    ctx.translate(-boss.x, -boss.y); // 다시 원위치로 이동 (반전된 상태에서)
  }

  const frameX = boss.frame * 120; // 120x120 픽셀 프레임
  const spriteW = 120;
  const spriteH = 120;
  const drawX = boss.x - spriteW / 2;
  const drawY = boss.y - spriteH / 2;

  ctx.drawImage(
    bossSprite,
    frameX, 0, spriteW, spriteH, // source rect (스프라이트 시트에서 가져올 영역)
    drawX, drawY, spriteW, spriteH // destination rect (캔버스에 그릴 영역)
  );

  ctx.restore(); // 저장된 캔버스 상태 복원

  // Boss HP Bar
  const barW = 200;
  const barH = 15;
  const barX = boss.x - barW/2;
  const barY = boss.y - boss.r - 35;
  ctx.fillStyle = '#555';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), barH);
  ctx.strokeStyle = 'white';
  ctx.strokeRect(barX, barY, barW, barH);
}

export function drawBossBullets(){
    for(const b of game.bossBullets){
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
    }
}

export function updateGrenades(dt) {
  for (let i = game.grenades.length - 1; i >= 0; i--) {
    const g = game.grenades[i];

    g.explosionDelayRemaining -= dt;

    if (g.explosionDelayRemaining <= 0) { // 지연 시간 종료 후 폭발
      // 폭발: 360도 탄막 생성
      const bulletCount = 24; // 탄막 개수
      const spd = 200; // 탄막 속도
      for (let j = 0; j < bulletCount; j++) {
        const angle = (Math.PI * 2 / bulletCount) * j;
        game.bossBullets.push({
          x: g.x, y: g.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          r: 6,
          life: 3, // 탄막 지속 시간
          color: '#ffcc00' // 노란색 탄막
        });
      }
      createExplosion(g.x,g.y, '#ffcc00'); // 폭발 이펙트
      game.grenades.splice(i, 1); // 수류탄 제거
      continue;
    }
    // 폭발 전 깜빡임 효과
    if (Math.floor(g.explosionDelayRemaining * 10) % 2 === 0) {
        g.color = '#ff0000'; // 빨간색으로 깜빡임
    } else {
        g.color = '#ffa500'; // 주황색으로 깜빡임
    }
  }
}

export function drawGrenades() {
  for (const g of game.grenades) {
    // 지연 중인 수류탄만 그림 (이제 던져지는 페이즈 없음)
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    // 폭발까지 남은 시간 표시
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(g.explosionDelayRemaining), g.x, g.y + 3);
  }
}

let grenadeSpawnTimer = 5; // 5초마다 수류탄 스폰

export function spawnGrenadesRandomly(dt) {
  if (!game.isBossBattle || !game.boss || game.boss.phase !== 'fighting') return;

  grenadeSpawnTimer -= dt;
  if (grenadeSpawnTimer <= 0) {
    grenadeSpawnTimer = 5; // 5초마다 리셋

    const bossHpPercentage = game.boss.hp / game.boss.maxHp;
    let grenadesToSpawn = 1;

    if (bossHpPercentage <= 0.5 && bossHpPercentage > 0.3) {
      grenadesToSpawn = 2;
    } else if (bossHpPercentage <= 0.3) {
      grenadesToSpawn = 3;
    }

    for (let i = 0; i < grenadesToSpawn; i++) {
      const randX = rand(50, game.W - 50); // 캔버스 내 무작위 X
      const randY = rand(50, game.H - 50); // 캔버스 내 무작위 Y

      game.grenades.push({
        x: randX,
        y: randY,
        r: 10,
        explosionDelayRemaining: 1, // 1초 후 폭발
        explosionDelay: 1, // 원래 폭발 지연 시간
        color: '#00ff00', // 녹색 수류탄
      });
    }
  }
}

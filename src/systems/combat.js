// src/systems/combat.js
import { game } from '../game.js';
import { openLevelUp } from '../ui.js';

const rand=(a,b)=>Math.random()*(b-a)+a;
export const circleHit=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y) <= (a.r+b.r);

export function createExplosion(x, y, color) {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 80 + 50;
    const life = Math.random() * 0.4 + 0.2;
    game.particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: life,
      maxLife: life,
      r: Math.random() * 2 + 1,
      color: color
    });
  }
}

export function shootIfReady(dt){
  const p=game.player;
  p.shootTimer -= dt;
  if(p.shootTimer>0) return;
  if(game.enemies.length===0 && !game.isBossBattle){ p.shootTimer = 0.1; return; }

  let target = null;
  if (game.isBossBattle && game.boss && game.boss.phase === 'fighting') {
    target = { e: game.boss, d: Math.hypot(game.boss.x - p.x, game.boss.y - p.y) };
  } else {
    target = game.enemies.reduce((acc,e)=>{
      const d = Math.hypot(e.x-p.x,e.y-p.y);
      return (!acc || d<acc.d) ? {e,d} : acc;
    }, null);
  }

  if(!target) return;
  const angle = Math.atan2(target.e.y-p.y, target.e.x-p.x);

  // 나선 로켓 스킬 로직 (6번째 공격)
  if(p.hasSpiralRocket && p.spiralRocketCharge >= 5){
    p.spiralRocketCharge = 0; // 카운터 리셋
    const spd = 450; // 약간 느리게
    const rocketDmg = p.dmg * 4 * p.spiralRocketDmgMultiplier;
    // 두 발의 로켓 발사
    game.bullets.push({ x:p.x, y:p.y, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd, r:6, dmg:rocketDmg, life:1.5, isSpiral:true, spiralAngle:0, color:'#ff99ff' });
    game.bullets.push({ x:p.x, y:p.y, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd, r:6, dmg:rocketDmg, life:1.5, isSpiral:true, spiralAngle:Math.PI * 2 / 3, color:'#ff99ff' });
    game.bullets.push({ x:p.x, y:p.y, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd, r:6, dmg:rocketDmg, life:1.5, isSpiral:true, spiralAngle:Math.PI * 4 / 3, color:'#ff99ff' });
    p.shootTimer = p.cooldown;
    return; // 로켓 발사 후 함수 종료
  }

  // 기본 공격
  const spd = 520;
  for(let i=0;i<p.projPerShot;i++){
    game.bullets.push({ x:p.x, y:p.y, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd, r:4, dmg:p.dmg, life:1.2 });
  }

  // 나선 로켓 스킬이 있으면 카운터 증가
  if(p.hasSpiralRocket) {
    p.spiralRocketCharge++;
  }

  p.shootTimer = p.cooldown;
}

export function updateBullets(dt){
  for(let i=game.bullets.length-1;i>=0;i--){
    const b=game.bullets[i];

    if(b.isSpiral){
      const spiralForce = 280; // 나선 강도
      const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; // 현재 진행방향의 수직방향
      b.vx += Math.cos(angle) * spiralForce * Math.cos(b.spiralAngle) * dt;
      b.vy += Math.sin(angle) * spiralForce * Math.cos(b.spiralAngle) * dt;
      b.spiralAngle += 20 * dt; // 나선 회전 속도
    }

    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(b.life<=0 || b.x<-30||b.x>game.W+30||b.y<-30||b.y>game.H+30){ game.bullets.splice(i,1); continue; }
    // 보스와 충돌
    if (game.isBossBattle && game.boss && game.boss.phase === 'fighting' && circleHit(b, game.boss)) {
      game.boss.hp -= b.dmg;
      b.life = 0; // 총알 제거
      createExplosion(b.x, b.y, b.color || '#ff6633'); // 보스 타격 효과
      if (game.boss.hp <= 0) {
        game.boss.hp = 0;
        game.boss.phase = 'defeated';
        game.isBossBattle = false; // 보스전 종료
        game.enemies.length = 0; // 남은 잡몹 제거
        game.player.level += 3; // 보스 클리어 보상: 레벨 3 증가
        game.levelsToDistribute += 3; // 3레벨 선택지를 추가
        if (game.levelsToDistribute === 3) { // 첫 번째 레벨업 선택지 표시
          openLevelUp();
        }

        game.levelUpFx.active = true; // 클리어 이펙트
        game.levelUpFx.progress = 0;
        game.shake = 30; // 화면 흔들림
        // TODO: 보스 처치 후 추가 보상이나 다음 단계 로직
      }
      break; // 보스에 맞았으면 다른 적 체크 안함
    }

    // 적과 충돌
    for(let j=game.enemies.length-1;j>=0;j--){
      const e=game.enemies[j];
      if(circleHit(b,e)){
        e.hp -= b.dmg; b.life=0;
        if(e.hp<=0){
          createExplosion(e.x, e.y, b.color || '#9b2bff');
          game.enemies.splice(j,1); game.kills++;
          dropFrom(e);
        }
        break;
      }
    }
  }
}

function dropFrom(e){
  game.pickups.push({type:'xp', value:20, x:e.x, y:e.y, vx:rand(-30,30), vy:rand(-30,30), r:6});
  if(Math.random()<0.08) game.pickups.push({type:'chicken', value:30, x:e.x, y:e.y, vx:rand(-20,20), vy:rand(-20,20), r:8});
}

export function tacticalScopeAttack(dt){
  const p = game.player;
  const bulletSpd = 800; // 궁극기 총알 속도
  const ultimateDmg = p.dmg; // 이미 버프된 데미지 사용

  // 모든 적에게 발사
  for (const e of game.enemies) {
    const angle = Math.atan2(e.y - p.y, e.x - p.x);
    game.bullets.push({ x:p.x, y:p.y, vx:Math.cos(angle)*bulletSpd, vy:Math.sin(angle)*bulletSpd, r:4, dmg:ultimateDmg, life:1.2, color:'#ffff00' }); // 노란색 총알
  }

  // 보스에게 발사 (보스전 중이고 보스가 전투 중일 때)
  if (game.isBossBattle && game.boss && game.boss.phase === 'fighting') {
    const boss = game.boss;
    const angle = Math.atan2(boss.y - p.y, boss.x - p.x);
    game.bullets.push({ x:p.x, y:p.y, vx:Math.cos(angle)*bulletSpd, vy:Math.sin(angle)*bulletSpd, r:4, dmg:ultimateDmg, life:1.2, color:'#ffff00' }); // 노란색 총알
  }
}
``
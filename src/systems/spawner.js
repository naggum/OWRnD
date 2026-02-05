// src/systems/spawner.js
import { game } from '../game.js';
import { circleHit } from './combat.js';

const rand=(a,b)=>Math.random()*(b-a)+a;

export function spawnEnemy(dt){
  if(game.isBossBattle) return; // 보스전 중에는 잡몹 스폰 금지
  game.spawnTimer -= dt;
  if(game.spawnTimer<=0){
    const side = Math.floor(rand(0,4));
    const margin=40;
    let x,y;
    if(side===0){x=-margin;y=rand(0,game.H);}
    if(side===1){x=game.W+margin;y=rand(0,game.H);}
    if(side===2){x=rand(0,game.W);y=-margin;}
    if(side===3){x=rand(0,game.W);y=game.H+margin;}
    const hp = 10 + game.diff * 6;
    const sp = 60 + Math.min(140, game.diff*6);
    game.enemies.push({x,y,r:12,hp,spd:sp, frame:0, animationTimer: 0});
    game.spawnRate = Math.max(0.35, game.spawnRate*0.99);

    const levelMultiplier = (1 / 1.2) ** Math.floor(game.player.level / 5);
    game.spawnTimer = game.spawnRate * levelMultiplier;
  }
}

export function updateEnemies(dt){
  const p = game.player;
  for(let i=game.enemies.length-1;i>=0;i--){
    const e=game.enemies[i];
    const ang = Math.atan2(p.y-e.y, p.x-e.x);
    e.x += Math.cos(ang)*e.spd*dt;
    e.y += Math.sin(ang)*e.spd*dt;

    // Animation
    e.animationTimer += dt;
    if (e.animationTimer > 0.5) { // 8 frames over 0.8 seconds = 0.1s per frame
      e.frame = (e.frame + 1) % 8; // 8 frames total
      e.animationTimer = 0;
    }

    if(circleHit(p,e) && p.invuln<=0){
      p.hp -= 12; p.invuln = 0.6;
      if(p.hp<=0){ p.hp=0; game.running=false; }
    }
  }
}

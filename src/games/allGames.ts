/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MiniGame, GameContext } from '../types';

// Helper: Generate particle bursts for visual juice when earning coins or taking damage
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

let particles: Particle[] = [];

export function addParticles(x: number, y: number, color: string, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

export function updateAndDrawParticles(ctx: CanvasRenderingContext2D) {
  particles = particles.filter((p) => p.alpha > 0);
  ctx.save();
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ==========================================
// GAME 1: SNAKE
// ==========================================
const SnakeGame: MiniGame = {
  id: 'snake',
  name: 'Neon Snake',
  icon: 'ChevronRight',
  description: 'Eat apples and dodge walls. Each apple grows your snake and earns coins.',
  controls: 'Arrow Keys or Swipe to navigate.',
  init: (ctx) => {
    ctx.savedState = {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      dx: 1,
      dy: 0,
      apple: { x: 15, y: 15 },
      gridSize: 20,
      moveTimer: 0,
      moveSpeed: 8, // updates every 8 frames
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.moveTimer++;
    if (s.moveTimer < s.moveSpeed) return;
    s.moveTimer = 0;

    // Move head
    const head = { x: s.snake[0].x + s.dx, y: s.snake[0].y + s.dy };

    // Collision check: walls
    const gridCount = 400 / s.gridSize; // 20x20 grid
    if (head.x < 0 || head.x >= gridCount || head.y < 0 || head.y >= gridCount) {
      ctx.onDamage();
      addParticles(200, 200, '#ef4444', 20);
      s.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      s.dx = 1;
      s.dy = 0;
      return;
    }

    // Collision check: self
    for (const part of s.snake) {
      if (part.x === head.x && part.y === head.y) {
        ctx.onDamage();
        addParticles(head.x * s.gridSize, head.y * s.gridSize, '#ef4444', 15);
        s.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
        s.dx = 1;
        s.dy = 0;
        return;
      }
    }

    s.snake.unshift(head);

    // Eat Apple
    if (head.x === s.apple.x && head.y === s.apple.y) {
      ctx.onCoin(5);
      addParticles(s.apple.x * s.gridSize + 10, s.apple.y * s.gridSize + 10, '#10b981', 12);
      // Spawn new apple
      let newApple;
      while (true) {
        newApple = {
          x: Math.floor(Math.random() * gridCount),
          y: Math.floor(Math.random() * gridCount),
        };
        const hits = s.snake.some((part: any) => part.x === newApple.x && part.y === newApple.y);
        if (!hits) break;
      }
      s.apple = newApple;
    } else {
      s.snake.pop();
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;
    const size = s.gridSize;

    // Grid draw
    c.strokeStyle = '#1e293b';
    c.lineWidth = 0.5;
    for (let i = 0; i <= 400; i += size) {
      c.beginPath();
      c.moveTo(i, 0); c.lineTo(i, 400);
      c.stroke();
      c.beginPath();
      c.moveTo(0, i); c.lineTo(400, i);
      c.stroke();
    }

    // Apple
    c.fillStyle = '#ef4444';
    c.shadowColor = '#ef4444';
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(s.apple.x * size + size / 2, s.apple.y * size + size / 2, size / 2 - 2, 0, Math.PI * 2);
    c.fill();

    // Snake
    c.shadowColor = '#10b981';
    c.shadowBlur = 10;
    s.snake.forEach((part: any, i: number) => {
      c.fillStyle = i === 0 ? '#34d399' : '#10b981';
      c.fillRect(part.x * size + 1, part.y * size + 1, size - 2, size - 2);
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'keydown') return;
    const s = ctx.savedState;
    const key = (e as KeyboardEvent).key;
    if ((key === 'ArrowUp' || key === 'w') && s.dy === 0) { s.dx = 0; s.dy = -1; }
    if ((key === 'ArrowDown' || key === 's') && s.dy === 0) { s.dx = 0; s.dy = 1; }
    if ((key === 'ArrowLeft' || key === 'a') && s.dx === 0) { s.dx = -1; s.dy = 0; }
    if ((key === 'ArrowRight' || key === 'd') && s.dx === 0) { s.dx = 1; s.dy = 0; }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 2: BOUNCE PONG
// ==========================================
const PongGame: MiniGame = {
  id: 'pong',
  name: 'Wall Pong',
  icon: 'Activity',
  description: 'Dodge the ball falling off. Bounce it off your paddle to earn coins.',
  controls: 'Mouse/Touch to move paddle vertically.',
  init: (ctx) => {
    ctx.savedState = {
      paddleY: 150,
      paddleH: 80,
      paddleW: 10,
      ballX: 200,
      ballY: 200,
      ballVX: -4,
      ballVY: 3,
      ballRadius: 8,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.ballX += s.ballVX;
    s.ballY += s.ballVY;

    // Bounce top/bottom
    if (s.ballY - s.ballRadius < 0) {
      s.ballY = s.ballRadius;
      s.ballVY = -s.ballVY;
    } else if (s.ballY + s.ballRadius > 400) {
      s.ballY = 400 - s.ballRadius;
      s.ballVY = -s.ballVY;
    }

    // Bounce right wall
    if (s.ballX + s.ballRadius > 400) {
      s.ballX = 400 - s.ballRadius;
      s.ballVX = -s.ballVX;
      addParticles(400, s.ballY, '#0ea5e9', 5);
    }

    // Left wall collision
    if (s.ballX - s.ballRadius < s.paddleW) {
      // Paddle check
      if (s.ballY >= s.paddleY && s.ballY <= s.paddleY + s.paddleH) {
        s.ballX = s.paddleW + s.ballRadius;
        s.ballVX = -s.ballVX * 1.05; // speed up slightly
        ctx.onCoin(3);
        addParticles(s.ballX, s.ballY, '#38bdf8', 10);
      } else {
        // Miss!
        ctx.onDamage();
        addParticles(s.ballX, s.ballY, '#ef4444', 15);
        s.ballX = 200;
        s.ballY = 200;
        s.ballVX = -4;
        s.ballVY = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
      }
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Paddle
    c.fillStyle = '#0ea5e9';
    c.shadowColor = '#0ea5e9';
    c.shadowBlur = 10;
    c.fillRect(0, s.paddleY, s.paddleW, s.paddleH);

    // Ball
    c.fillStyle = '#38bdf8';
    c.shadowColor = '#38bdf8';
    c.beginPath();
    c.arc(s.ballX, s.ballY, s.ballRadius, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (e.type === 'move') {
      const me = e as any;
      if (me.clientY !== undefined) {
        // Get relative to canvas bounding box if clientY exists
        const rect = me.currentTarget?.getBoundingClientRect();
        if (rect) {
          s.paddleY = me.clientY - rect.top - s.paddleH / 2;
        }
      } else if (me.touches && me.touches[0]) {
        const rect = me.currentTarget?.getBoundingClientRect();
        if (rect) {
          s.paddleY = me.touches[0].clientY - rect.top - s.paddleH / 2;
        }
      }
      // Clamp paddleY
      s.paddleY = Math.max(0, Math.min(400 - s.paddleH, s.paddleY));
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 3: FLAPPY FLAP
// ==========================================
const FlappyGame: MiniGame = {
  id: 'flappy',
  name: 'Neon Flap',
  icon: 'Wind',
  description: 'Tap or Space to flap through neon pipes. Avoid falling or hitting obstacles.',
  controls: 'Click/Touch or Space to Flap.',
  init: (ctx) => {
    ctx.savedState = {
      birdY: 200,
      birdVY: 0,
      gravity: 0.25,
      flapStrength: -5,
      pipes: [
        { x: 400, top: 120, bottom: 280, passed: false },
        { x: 600, top: 160, bottom: 320, passed: false },
      ],
      pipeWidth: 50,
      gap: 120,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.birdVY += s.gravity;
    s.birdY += s.birdVY;

    // Ground or ceiling crash
    if (s.birdY < 0 || s.birdY > 400) {
      ctx.onDamage();
      addParticles(100, s.birdY, '#ef4444', 15);
      s.birdY = 150;
      s.birdVY = 0;
      s.pipes = [
        { x: 400, top: 120, bottom: 280, passed: false },
        { x: 600, top: 160, bottom: 320, passed: false },
      ];
      return;
    }

    // Move pipes
    s.pipes.forEach((p: any) => {
      p.x -= 2;

      // Check collision
      if (p.x < 100 + 15 && p.x + s.pipeWidth > 100 - 15) {
        if (s.birdY - 10 < p.top || s.birdY + 10 > p.bottom) {
          ctx.onDamage();
          addParticles(100, s.birdY, '#ef4444', 15);
          p.x = 450; // teleport away
        }
      }

      // Check score
      if (!p.passed && p.x + s.pipeWidth < 100) {
        p.passed = true;
        ctx.onCoin(4);
        addParticles(100, s.birdY, '#eab308', 10);
      }
    });

    // Recycle pipes
    if (s.pipes[0].x < -s.pipeWidth) {
      s.pipes.shift();
      const lastX = s.pipes[s.pipes.length - 1].x;
      const topH = 50 + Math.random() * 150;
      s.pipes.push({
        x: lastX + 200,
        top: topH,
        bottom: topH + s.gap,
        passed: false,
      });
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw pipes
    c.fillStyle = '#eab308';
    c.shadowColor = '#eab308';
    s.pipes.forEach((p: any) => {
      c.shadowBlur = 10;
      c.fillRect(p.x, 0, s.pipeWidth, p.top);
      c.fillRect(p.x, p.bottom, s.pipeWidth, 400 - p.bottom);
    });

    // Draw bird (neon yellow circle)
    c.fillStyle = '#fef08a';
    c.shadowColor = '#fef08a';
    c.shadowBlur = 12;
    c.beginPath();
    c.arc(100, s.birdY, 12, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type === 'down') {
      const s = ctx.savedState;
      s.birdVY = s.flapStrength;
      addParticles(100, s.birdY, '#fef08a', 4);
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 4: RETRO ARCHER (MINI-ARCHERO)
// ==========================================
const ArcherGame: MiniGame = {
  id: 'archer',
  name: 'Cyber Archer',
  icon: 'Shield',
  description: 'Dodge the cyber-drones! Shoot down targets by standing still.',
  controls: 'Click/Touch to move. Stand still to auto-fire at nearest drone.',
  init: (ctx) => {
    ctx.savedState = {
      player: { x: 200, y: 300, r: 12, targetX: 200, targetY: 300, isMoving: false },
      drones: [
        { x: 100, y: 80, hp: 30, maxHp: 30, vx: 1.5, r: 14 },
        { x: 300, y: 120, hp: 30, maxHp: 30, vx: -1.5, r: 14 },
      ],
      arrows: [],
      fireCooldown: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    const p = s.player;

    // Move player
    if (p.isMoving) {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        p.x = p.targetX;
        p.y = p.targetY;
        p.isMoving = false;
      } else {
        p.x += (dx / dist) * 4;
        p.y += (dy / dist) * 4;
      }
    }

    // Stand still auto-fire
    if (!p.isMoving && s.drones.length > 0) {
      s.fireCooldown--;
      if (s.fireCooldown <= 0) {
        s.fireCooldown = 25; // fire arrow
        // Find nearest drone
        let nearest: any = null;
        let minDist = 9999;
        s.drones.forEach((d: any) => {
          const dist = Math.hypot(d.x - p.x, d.y - p.y);
          if (dist < minDist) {
            minDist = dist;
            nearest = d;
          }
        });

        if (nearest) {
          const adx = nearest.x - p.x;
          const ady = nearest.y - p.y;
          const adist = Math.hypot(adx, ady);
          s.arrows.push({
            x: p.x,
            y: p.y,
            vx: (adx / adist) * 6,
            vy: (ady / adist) * 6,
          });
        }
      }
    }

    // Move arrows
    s.arrows.forEach((a: any, index: number) => {
      a.x += a.vx;
      a.y += a.vy;

      // Collision with drones
      s.drones.forEach((d: any, dIndex: number) => {
        if (Math.hypot(a.x - d.x, a.y - d.y) < d.r) {
          d.hp -= 10;
          s.arrows.splice(index, 1);
          addParticles(d.x, d.y, '#f43f5e', 8);

          if (d.hp <= 0) {
            s.drones.splice(dIndex, 1);
            ctx.onCoin(10);
            addParticles(d.x, d.y, '#f43f5e', 18);
          }
        }
      });
    });

    // Remove off-screen arrows
    s.arrows = s.arrows.filter((a: any) => a.x > 0 && a.x < 400 && a.y > 0 && a.y < 400);

    // Update drones & hit player
    s.drones.forEach((d: any) => {
      d.x += d.vx;
      if (d.x - d.r < 0 || d.x + d.r > 400) {
        d.vx = -d.vx;
      }

      // Hit check
      if (Math.hypot(d.x - p.x, d.y - p.y) < d.r + p.r) {
        ctx.onDamage();
        addParticles(p.x, p.y, '#ef4444', 15);
        p.x = 200; p.y = 300; p.targetX = 200; p.targetY = 300; p.isMoving = false;
      }
    });

    // Respawn drones if empty
    if (s.drones.length === 0) {
      s.drones.push(
        { x: 80, y: 80 + Math.random() * 40, hp: 30, maxHp: 30, vx: 2, r: 14 },
        { x: 320, y: 100 + Math.random() * 40, hp: 30, maxHp: 30, vx: -2, r: 14 }
      );
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;
    const p = s.player;

    // Draw Target / Marker if moving
    if (p.isMoving) {
      c.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(p.targetX, p.targetY, 15, 0, Math.PI * 2);
      c.stroke();
    }

    // Draw Player
    c.fillStyle = '#ec4899';
    c.shadowColor = '#ec4899';
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    c.fill();

    // Draw Arrows
    c.fillStyle = '#f472b6';
    c.shadowColor = '#f472b6';
    s.arrows.forEach((a: any) => {
      c.beginPath();
      c.arc(a.x, a.y, 4, 0, Math.PI * 2);
      c.fill();
    });

    // Draw Drones
    s.drones.forEach((d: any) => {
      c.fillStyle = '#a855f7';
      c.shadowColor = '#a855f7';
      c.beginPath();
      c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      c.fill();

      // Health bar
      c.fillStyle = '#1e293b';
      c.fillRect(d.x - 15, d.y - d.r - 8, 30, 4);
      c.fillStyle = '#a855f7';
      c.fillRect(d.x - 15, d.y - d.r - 8, 30 * (d.hp / d.maxHp), 4);
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    const p = s.player;
    if (e.type === 'down') {
      const me = e as any;
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        if (me.clientX !== undefined) {
          p.targetX = me.clientX - rect.left;
          p.targetY = me.clientY - rect.top;
        } else if (me.touches && me.touches[0]) {
          p.targetX = me.touches[0].clientX - rect.left;
          p.targetY = me.touches[0].clientY - rect.top;
        }
        // bound targets
        p.targetX = Math.max(15, Math.min(385, p.targetX));
        p.targetY = Math.max(15, Math.min(385, p.targetY));
        p.isMoving = true;
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 5: ASTEROID BLITZ
// ==========================================
const AsteroidGame: MiniGame = {
  id: 'asteroid',
  name: 'Asteroid Blitz',
  icon: 'Zap',
  description: 'Rotate and thrust your ship. Shoot oncoming asteroids for coins.',
  controls: 'A/D to Rotate, W to Thrust, Space to Shoot.',
  init: (ctx) => {
    ctx.savedState = {
      shipX: 200,
      shipY: 200,
      shipAngle: -Math.PI / 2,
      shipRot: 0,
      shipThrust: false,
      vx: 0, vy: 0,
      bullets: [],
      asteroids: [
        { x: 50, y: 50, vx: 0.8, vy: 0.5, size: 25 },
        { x: 350, y: 50, vx: -0.6, vy: 0.8, size: 20 },
        { x: 100, y: 350, vx: 0.5, vy: -0.7, size: 30 },
      ],
      fireCooldown: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;

    // Rotate and thrust
    s.shipAngle += s.shipRot;
    if (s.shipThrust) {
      s.vx += Math.cos(s.shipAngle) * 0.15;
      s.vy += Math.sin(s.shipAngle) * 0.15;
    }
    // Friction
    s.vx *= 0.98;
    s.vy *= 0.98;

    s.shipX += s.vx;
    s.shipY += s.vy;

    // Wrap ship bounds
    if (s.shipX < 0) s.shipX += 400; if (s.shipX > 400) s.shipX -= 400;
    if (s.shipY < 0) s.shipY += 400; if (s.shipY > 400) s.shipY -= 400;

    // Move bullets
    s.bullets.forEach((b: any, bIndex: number) => {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.life <= 0) s.bullets.splice(bIndex, 1);
    });

    // Move asteroids and check collision
    s.asteroids.forEach((ast: any, aIndex: number) => {
      ast.x += ast.vx;
      ast.y += ast.vy;

      // Wrap
      if (ast.x < 0) ast.x += 400; if (ast.x > 400) ast.x -= 400;
      if (ast.y < 0) ast.y += 400; if (ast.y > 400) ast.y -= 400;

      // Bullet hitting asteroid
      s.bullets.forEach((b: any, bIndex: number) => {
        if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.size) {
          ctx.onCoin(6);
          addParticles(ast.x, ast.y, '#22d3ee', 15);
          s.bullets.splice(bIndex, 1);

          // Split asteroid
          if (ast.size > 15) {
            s.asteroids.push(
              { x: ast.x, y: ast.y, vx: ast.vy * 1.2, vy: -ast.vx * 1.2, size: ast.size - 10 },
              { x: ast.x, y: ast.y, vx: -ast.vy * 1.2, vy: ast.vx * 1.2, size: ast.size - 10 }
            );
          }
          s.asteroids.splice(aIndex, 1);
        }
      });

      // Ast hitting ship
      if (Math.hypot(s.shipX - ast.x, s.shipY - ast.y) < ast.size + 10) {
        ctx.onDamage();
        addParticles(s.shipX, s.shipY, '#ef4444', 20);
        s.shipX = 200; s.shipY = 200; s.vx = 0; s.vy = 0;
      }
    });

    if (s.asteroids.length === 0) {
      s.asteroids.push(
        { x: Math.random() * 400, y: Math.random() * 100, vx: Math.random() - 0.5, vy: Math.random() - 0.5, size: 25 }
      );
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Ship drawing
    c.save();
    c.translate(s.shipX, s.shipY);
    c.rotate(s.shipAngle);
    c.strokeStyle = '#22d3ee';
    c.shadowColor = '#22d3ee';
    c.shadowBlur = 10;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(12, 0);
    c.lineTo(-10, -8);
    c.lineTo(-6, 0);
    c.lineTo(-10, 8);
    c.closePath();
    c.stroke();
    c.restore();

    // Bullets
    c.fillStyle = '#06b6d4';
    c.shadowColor = '#06b6d4';
    s.bullets.forEach((b: any) => {
      c.beginPath();
      c.arc(b.x, b.y, 3, 0, Math.PI * 2);
      c.fill();
    });

    // Asteroids
    c.strokeStyle = '#e2e8f0';
    c.shadowColor = '#e2e8f0';
    c.lineWidth = 1.5;
    s.asteroids.forEach((ast: any) => {
      c.beginPath();
      c.arc(ast.x, ast.y, ast.size, 0, Math.PI * 2);
      c.stroke();
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (e.type === 'keydown') {
      const key = (e as KeyboardEvent).key;
      if (key === 'ArrowLeft' || key === 'a') s.shipRot = -0.07;
      if (key === 'ArrowRight' || key === 'd') s.shipRot = 0.07;
      if (key === 'ArrowUp' || key === 'w') s.shipThrust = true;
      if (key === ' ') {
        s.bullets.push({
          x: s.shipX + Math.cos(s.shipAngle) * 12,
          y: s.shipY + Math.sin(s.shipAngle) * 12,
          vx: Math.cos(s.shipAngle) * 7 + s.vx,
          vy: Math.sin(s.shipAngle) * 7 + s.vy,
          life: 50,
        });
      }
    } else if (e.type === 'keyup') {
      const key = (e as KeyboardEvent).key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') s.shipRot = 0;
      if (key === 'ArrowUp' || key === 'w') s.shipThrust = false;
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 6: BRICK BREAKER
// ==========================================
const BrickGame: MiniGame = {
  id: 'brick',
  name: 'Retro Breaker',
  icon: 'Grid',
  description: 'Bounce the ball to break neon blocks. Clearing bricks earns coins.',
  controls: 'Mouse/Touch horizontally to move paddle.',
  init: (ctx) => {
    const bricks = [];
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        bricks.push({
          x: 10 + c * 48,
          y: 40 + r * 18,
          w: 42,
          h: 12,
          color: colors[r],
          active: true,
        });
      }
    }
    ctx.savedState = {
      paddleX: 160,
      paddleW: 80,
      paddleH: 10,
      ballX: 200,
      ballY: 250,
      ballVX: 3,
      ballVY: -3,
      ballRadius: 7,
      bricks,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.ballX += s.ballVX;
    s.ballY += s.ballVY;

    // Wall bounce
    if (s.ballX - s.ballRadius < 0) {
      s.ballX = s.ballRadius; s.ballVX = -s.ballVX;
    } else if (s.ballX + s.ballRadius > 400) {
      s.ballX = 400 - s.ballRadius; s.ballVX = -s.ballVX;
    }
    if (s.ballY - s.ballRadius < 0) {
      s.ballY = s.ballRadius; s.ballVY = -s.ballVY;
    }

    // Paddle bounce
    if (s.ballY + s.ballRadius > 370 && s.ballY - s.ballRadius < 380) {
      if (s.ballX >= s.paddleX && s.ballX <= s.paddleX + s.paddleW) {
        s.ballY = 370 - s.ballRadius;
        // Adjust angle based on where it hit the paddle
        const hitPoint = (s.ballX - (s.paddleX + s.paddleW / 2)) / (s.paddleW / 2);
        s.ballVX = hitPoint * 4.5;
        s.ballVY = -Math.max(2, Math.abs(s.ballVY));
        addParticles(s.ballX, s.ballY, '#10b981', 8);
      }
    }

    // Brick hits
    s.bricks.forEach((b: any) => {
      if (b.active) {
        if (s.ballX + s.ballRadius > b.x && s.ballX - s.ballRadius < b.x + b.w &&
            s.ballY + s.ballRadius > b.y && s.ballY - s.ballRadius < b.y + b.h) {
          b.active = false;
          s.ballVY = -s.ballVY;
          ctx.onCoin(3);
          addParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 12);
        }
      }
    });

    // Floor death
    if (s.ballY > 400) {
      ctx.onDamage();
      addParticles(200, 380, '#ef4444', 15);
      s.ballX = 200;
      s.ballY = 250;
      s.ballVX = (Math.random() > 0.5 ? 2.5 : -2.5);
      s.ballVY = -3;
    }

    // Respawn bricks if all gone
    if (s.bricks.every((b: any) => !b.active)) {
      s.bricks.forEach((b: any) => b.active = true);
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Paddle
    c.fillStyle = '#10b981';
    c.shadowColor = '#10b981';
    c.shadowBlur = 10;
    c.fillRect(s.paddleX, 370, s.paddleW, s.paddleH);

    // Ball
    c.fillStyle = '#e2e8f0';
    c.shadowColor = '#e2e8f0';
    c.beginPath();
    c.arc(s.ballX, s.ballY, s.ballRadius, 0, Math.PI * 2);
    c.fill();

    // Bricks
    s.bricks.forEach((b: any) => {
      if (b.active) {
        c.fillStyle = b.color;
        c.shadowColor = b.color;
        c.shadowBlur = 6;
        c.fillRect(b.x, b.y, b.w, b.h);
      }
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (e.type === 'move') {
      const me = e as any;
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        if (me.clientX !== undefined) {
          s.paddleX = me.clientX - rect.left - s.paddleW / 2;
        } else if (me.touches && me.touches[0]) {
          s.paddleX = me.touches[0].clientX - rect.left - s.paddleW / 2;
        }
        s.paddleX = Math.max(0, Math.min(400 - s.paddleW, s.paddleX));
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 7: DINO DASH (T-REX RUN)
// ==========================================
const DinoGame: MiniGame = {
  id: 'dino',
  name: 'T-Rex Dash',
  icon: 'Flame',
  description: 'Jump over high-speed obstacles. Survival yields steady global coins.',
  controls: 'Click/Touch or Space to JUMP.',
  init: (ctx) => {
    ctx.savedState = {
      dinoY: 300,
      dinoVY: 0,
      isGrounded: true,
      gravity: 0.5,
      obstacles: [{ x: 450, w: 15, h: 30, speed: 4.5 }],
      coinTimer: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;

    // Dino Physics
    if (!s.isGrounded) {
      s.dinoVY += s.gravity;
      s.dinoY += s.dinoVY;
      if (s.dinoY >= 300) {
        s.dinoY = 300;
        s.dinoVY = 0;
        s.isGrounded = true;
      }
    }

    // Tick score
    s.coinTimer++;
    if (s.coinTimer % 60 === 0) {
      ctx.onCoin(2);
    }

    // Move obstacles
    s.obstacles.forEach((obs: any) => {
      obs.x -= obs.speed;

      // Collide
      if (obs.x < 100 + 16 && obs.x + obs.w > 100 - 16) {
        if (s.dinoY + 20 > 340 - obs.h) {
          ctx.onDamage();
          addParticles(100, s.dinoY + 10, '#f97316', 15);
          obs.x = 450; // shift out
        }
      }
    });

    // Recycle obstacle
    if (s.obstacles[0].x < -50) {
      s.obstacles.shift();
      s.obstacles.push({
        x: 400 + Math.random() * 100,
        w: 12 + Math.random() * 8,
        h: 25 + Math.random() * 15,
        speed: 4.5 + Math.random() * 1.5,
      });
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Floor line
    c.strokeStyle = '#334155';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 340);
    c.lineTo(400, 340);
    c.stroke();

    // Dino (Neon Orange)
    c.fillStyle = '#f97316';
    c.shadowColor = '#f97316';
    c.shadowBlur = 10;
    c.fillRect(80, s.dinoY, 24, 40);

    // Obstacles
    c.fillStyle = '#f43f5e';
    c.shadowColor = '#f43f5e';
    s.obstacles.forEach((obs: any) => {
      c.fillRect(obs.x, 340 - obs.h, obs.w, obs.h);
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (e.type === 'down' && s.isGrounded) {
      s.dinoVY = -9.5;
      s.isGrounded = false;
      addParticles(92, 330, '#f97316', 4);
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 8: NEON SIMON (SIMON SAYS)
// ==========================================
const SimonGame: MiniGame = {
  id: 'simon',
  name: 'Neon Simon',
  icon: 'Disc',
  description: 'Repeat the cyber sequence. Tap quadrants in the correct order.',
  controls: 'Click the flashing panels matching the sequence.',
  init: (ctx) => {
    ctx.savedState = {
      sequence: [Math.floor(Math.random() * 4)],
      playerIndex: 0,
      activeColor: -1,
      flashTimer: 0,
      isShowingSequence: true,
      seqStep: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    if (s.isShowingSequence) {
      s.flashTimer++;
      if (s.flashTimer === 1) {
        s.activeColor = s.sequence[s.seqStep];
      } else if (s.flashTimer === 25) {
        s.activeColor = -1;
      } else if (s.flashTimer >= 35) {
        s.flashTimer = 0;
        s.seqStep++;
        if (s.seqStep >= s.sequence.length) {
          s.isShowingSequence = false;
          s.playerIndex = 0;
        }
      }
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    const centers = [
      { x: 130, y: 130, c: '#ef4444', glow: '#f87171' }, // Top-Left Red
      { x: 270, y: 130, c: '#3b82f6', glow: '#60a5fa' }, // Top-Right Blue
      { x: 130, y: 270, c: '#10b981', glow: '#34d399' }, // Bottom-Left Green
      { x: 270, y: 270, c: '#eab308', glow: '#facc15' }, // Bottom-Right Yellow
    ];

    centers.forEach((item, index) => {
      const active = s.activeColor === index;
      c.fillStyle = active ? item.glow : item.c;
      c.shadowColor = item.glow;
      c.shadowBlur = active ? 20 : 4;
      c.fillRect(item.x - 60, item.y - 60, 120, 120);
    });

    c.shadowBlur = 0;
    if (s.isShowingSequence) {
      c.fillStyle = '#fff';
      c.font = '14px sans-serif';
      c.fillText('Watch Sequence...', 145, 30);
    } else {
      c.fillStyle = '#fff';
      c.font = '14px sans-serif';
      c.fillText('Your Turn!', 165, 30);
    }
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (s.isShowingSequence || e.type !== 'down') return;

    const me = e as any;
    const rect = me.currentTarget?.getBoundingClientRect();
    if (rect) {
      let cx = 0, cy = 0;
      if (me.clientX !== undefined) {
        cx = me.clientX - rect.left; cy = me.clientY - rect.top;
      } else if (me.touches && me.touches[0]) {
        cx = me.touches[0].clientX - rect.left; cy = me.touches[0].clientY - rect.top;
      }

      let clickedIndex = -1;
      if (cx > 70 && cx < 190 && cy > 70 && cy < 190) clickedIndex = 0;
      if (cx > 210 && cx < 330 && cy > 70 && cy < 190) clickedIndex = 1;
      if (cx > 70 && cx < 190 && cy > 210 && cy < 330) clickedIndex = 2;
      if (cx > 210 && cx < 330 && cy > 210 && cy < 330) clickedIndex = 3;

      if (clickedIndex !== -1) {
        s.activeColor = clickedIndex;
        setTimeout(() => s.activeColor = -1, 150);

        if (clickedIndex === s.sequence[s.playerIndex]) {
          s.playerIndex++;
          if (s.playerIndex >= s.sequence.length) {
            // Success round!
            ctx.onCoin(15);
            addParticles(200, 200, '#10b981', 15);
            s.sequence.push(Math.floor(Math.random() * 4));
            s.isShowingSequence = true;
            s.seqStep = 0;
            s.flashTimer = 0;
          }
        } else {
          // Wrong!
          ctx.onDamage();
          addParticles(200, 200, '#ef4444', 18);
          s.sequence = [Math.floor(Math.random() * 4)];
          s.isShowingSequence = true;
          s.seqStep = 0;
          s.flashTimer = 0;
        }
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 9: FRUIT SLICER
// ==========================================
const SlicerGame: MiniGame = {
  id: 'slicer',
  name: 'Cyber Slice',
  icon: 'Scissors',
  description: 'Dodge the cyber-bombs! Drag or swipe across neon cells to slash them.',
  controls: 'Drag mouse or touch across elements.',
  init: (ctx) => {
    ctx.savedState = {
      items: [
        { x: 100, y: 410, vx: 2, vy: -12, r: 20, isBomb: false, sliced: false },
        { x: 300, y: 410, vx: -2, vy: -11, r: 20, isBomb: true, sliced: false },
      ],
      spawnTimer: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.spawnTimer++;
    if (s.spawnTimer > 70) {
      s.spawnTimer = 0;
      s.items.push({
        x: 50 + Math.random() * 300,
        y: 410,
        vx: (Math.random() - 0.5) * 4,
        vy: -10 - Math.random() * 4,
        r: 18,
        isBomb: Math.random() > 0.75,
        sliced: false,
      });
    }

    s.items.forEach((item: any, index: number) => {
      item.x += item.vx;
      item.y += item.vy;
      item.vy += 0.2; // gravity

      // Fall off bottom check
      if (item.y > 450) {
        if (!item.isBomb && !item.sliced) {
          ctx.onDamage(); // penalty for missing target
        }
        s.items.splice(index, 1);
      }
    });
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    s.items.forEach((item: any) => {
      if (item.sliced) {
        // Draw halves
        c.fillStyle = '#ec4899';
        c.shadowColor = '#ec4899';
        c.fillRect(item.x - 15, item.y, 10, 16);
        c.fillRect(item.x + 5, item.y + 4, 10, 16);
      } else {
        c.shadowBlur = 10;
        if (item.isBomb) {
          c.fillStyle = '#ef4444';
          c.shadowColor = '#ef4444';
        } else {
          c.fillStyle = '#10b981';
          c.shadowColor = '#10b981';
        }
        c.beginPath();
        c.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        c.fill();
      }
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'move') return;
    const s = ctx.savedState;
    const me = e as any;
    const rect = me.currentTarget?.getBoundingClientRect();
    if (rect) {
      let sx = 0, sy = 0;
      if (me.clientX !== undefined) {
        sx = me.clientX - rect.left; sy = me.clientY - rect.top;
      } else if (me.touches && me.touches[0]) {
        sx = me.touches[0].clientX - rect.left; sy = me.touches[0].clientY - rect.top;
      }

      s.items.forEach((item: any) => {
        if (!item.sliced && Math.hypot(item.x - sx, item.y - sy) < item.r + 5) {
          item.sliced = true;
          if (item.isBomb) {
            ctx.onDamage();
            addParticles(item.x, item.y, '#ef4444', 20);
          } else {
            ctx.onCoin(8);
            addParticles(item.x, item.y, '#10b981', 12);
          }
        }
      });
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 10: MEMORY CARDS
// ==========================================
const MemoryGame: MiniGame = {
  id: 'memory',
  name: 'Cyber Cards',
  icon: 'Layers',
  description: 'Reveal and pair cyber cards. Getting pairs awards coins.',
  controls: 'Click/Touch cards to reveal them.',
  init: (ctx) => {
    // 4x4 matching cards
    const symbols = ['👾', '🚀', '💿', '⚡', '🔋', '🔮', '🛡️', '🧬'];
    let cards = [...symbols, ...symbols]
      .map((sym, i) => ({ id: i, sym, revealed: false, matched: false }))
      .sort(() => Math.random() - 0.5);

    ctx.savedState = {
      cards,
      selected: [],
      mismatchCount: 0,
      lockout: false,
    };
  },
  update: () => {},
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    s.cards.forEach((card: any, i: number) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = 40 + col * 85;
      const y = 40 + row * 85;

      c.shadowBlur = 6;
      if (card.matched) {
        c.fillStyle = '#0f172a';
        c.strokeStyle = '#334155';
        c.shadowColor = '#334155';
        c.fillRect(x, y, 70, 70);
        c.strokeRect(x, y, 70, 70);
      } else if (card.revealed) {
        c.fillStyle = '#1e293b';
        c.strokeStyle = '#22d3ee';
        c.shadowColor = '#22d3ee';
        c.fillRect(x, y, 70, 70);
        c.strokeRect(x, y, 70, 70);

        // Sym
        c.fillStyle = '#fff';
        c.font = '24px sans-serif';
        c.fillText(card.sym, x + 20, y + 45);
      } else {
        c.fillStyle = '#06b6d4';
        c.shadowColor = '#06b6d4';
        c.fillRect(x, y, 70, 70);
      }
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (s.lockout || e.type !== 'down') return;

    const me = e as any;
    const rect = me.currentTarget?.getBoundingClientRect();
    if (rect) {
      let clickX = 0, clickY = 0;
      if (me.clientX !== undefined) {
        clickX = me.clientX - rect.left; clickY = me.clientY - rect.top;
      } else if (me.touches && me.touches[0]) {
        clickX = me.touches[0].clientX - rect.left; clickY = me.touches[0].clientY - rect.top;
      }

      // Find clicked card
      s.cards.forEach((card: any, i: number) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const x = 40 + col * 85;
        const y = 40 + row * 85;

        if (clickX >= x && clickX <= x + 70 && clickY >= y && clickY <= y + 70) {
          if (!card.revealed && !card.matched && s.selected.length < 2) {
            card.revealed = true;
            s.selected.push(card);

            if (s.selected.length === 2) {
              const [first, second] = s.selected;
              if (first.sym === second.sym) {
                // Match!
                first.matched = true;
                second.matched = true;
                ctx.onCoin(10);
                addParticles(clickX, clickY, '#22d3ee', 12);
                s.selected = [];

                // Reset cards if all matched
                if (s.cards.every((c: any) => c.matched)) {
                  setTimeout(() => {
                    s.cards = s.cards.sort(() => Math.random() - 0.5);
                    s.cards.forEach((c: any) => { c.matched = false; c.revealed = false; });
                  }, 1000);
                }
              } else {
                // Mismatch
                s.lockout = true;
                s.mismatchCount++;
                if (s.mismatchCount >= 4) {
                  ctx.onDamage();
                  s.mismatchCount = 0;
                  addParticles(200, 200, '#ef4444', 15);
                }
                setTimeout(() => {
                  first.revealed = false;
                  second.revealed = false;
                  s.selected = [];
                  s.lockout = false;
                }, 1000);
              }
            }
          }
        }
      });
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 11: WHACK-A-MOLE
// ==========================================
const WhackGame: MiniGame = {
  id: 'whack',
  name: 'Core Whack',
  icon: 'Radio',
  description: 'Tap popping nodes instantly. Missing them damages global health!',
  controls: 'Click/Touch the glowing nodes.',
  init: (ctx) => {
    ctx.savedState = {
      moles: [
        { active: false, timer: 0, maxTimer: 60, x: 100, y: 100, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 200, y: 100, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 300, y: 100, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 100, y: 200, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 200, y: 200, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 300, y: 200, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 100, y: 300, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 200, y: 300, type: 'normal' },
        { active: false, timer: 0, maxTimer: 60, x: 300, y: 300, type: 'normal' },
      ],
      popCooldown: 30,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.popCooldown--;
    if (s.popCooldown <= 0) {
      s.popCooldown = 40 + Math.random() * 30;
      // Trigger random inactive mole
      const inactive = s.moles.filter((m: any) => !m.active);
      if (inactive.length > 0) {
        const selected = inactive[Math.floor(Math.random() * inactive.length)];
        selected.active = true;
        selected.type = Math.random() > 0.8 ? 'gold' : 'normal';
        selected.timer = 0;
        selected.maxTimer = 55 + Math.random() * 25;
      }
    }

    s.moles.forEach((m: any) => {
      if (m.active) {
        m.timer++;
        if (m.timer >= m.maxTimer) {
          m.active = false;
          if (m.type === 'normal') {
            ctx.onDamage(); // hit if normal was missed
            addParticles(m.x, m.y, '#f43f5e', 10);
          }
        }
      }
    });
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    s.moles.forEach((m: any) => {
      // Hole
      c.fillStyle = '#0f172a';
      c.strokeStyle = '#334155';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(m.x, m.y, 25, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      if (m.active) {
        const radius = 22 * Math.sin((m.timer / m.maxTimer) * Math.PI);
        c.fillStyle = m.type === 'gold' ? '#eab308' : '#f43f5e';
        c.shadowColor = m.type === 'gold' ? '#facc15' : '#f43f5e';
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(m.x, m.y, radius > 0 ? radius : 1, 0, Math.PI * 2);
        c.fill();
      }
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;
    const me = e as any;
    const rect = me.currentTarget?.getBoundingClientRect();
    if (rect) {
      let cx = 0, cy = 0;
      if (me.clientX !== undefined) {
        cx = me.clientX - rect.left; cy = me.clientY - rect.top;
      } else if (me.touches && me.touches[0]) {
        cx = me.touches[0].clientX - rect.left; cy = me.touches[0].clientY - rect.top;
      }

      s.moles.forEach((m: any) => {
        if (m.active && Math.hypot(m.x - cx, m.y - cy) < 25) {
          m.active = false;
          if (m.type === 'gold') {
            ctx.onCoin(20);
            addParticles(m.x, m.y, '#eab308', 20);
          } else {
            ctx.onCoin(5);
            addParticles(m.x, m.y, '#f43f5e', 12);
          }
        }
      });
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 12: GRID MINE SWEEPER
// ==========================================
const MineGame: MiniGame = {
  id: 'mine',
  name: 'Mine Sweep',
  icon: 'ShieldAlert',
  description: 'Reveal nodes cautiously. Detonating a sub-mine triggers damage!',
  controls: 'Click to reveal. Safe nodes award coins.',
  init: (ctx) => {
    // 5x5 grid
    const grid: any[] = [];
    const mineIndices = new Set<number>();
    while (mineIndices.size < 4) {
      mineIndices.add(Math.floor(Math.random() * 25));
    }

    for (let i = 0; i < 25; i++) {
      grid.push({
        id: i,
        isMine: mineIndices.has(i),
        revealed: false,
        neighborMines: 0,
      });
    }

    // Calculate neighbors
    for (let i = 0; i < 25; i++) {
      if (grid[i].isMine) continue;
      const r = Math.floor(i / 5);
      const c = i % 5;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
            if (grid[nr * 5 + nc].isMine) count++;
          }
        }
      }
      grid[i].neighborMines = count;
    }

    ctx.savedState = { grid };
  },
  update: () => {},
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    s.grid.forEach((cell: any, i: number) => {
      const row = Math.floor(i / 5);
      const col = i % 5;
      const x = 50 + col * 64;
      const y = 50 + row * 64;

      c.shadowBlur = 4;
      if (cell.revealed) {
        c.fillStyle = cell.isMine ? '#ef4444' : '#1e293b';
        c.shadowColor = cell.isMine ? '#ef4444' : '#334155';
        c.fillRect(x, y, 54, 54);

        if (!cell.isMine && cell.neighborMines > 0) {
          c.fillStyle = '#38bdf8';
          c.font = 'bold 18px sans-serif';
          c.fillText(cell.neighborMines.toString(), x + 21, y + 33);
        } else if (cell.isMine) {
          c.fillStyle = '#fff';
          c.font = '18px sans-serif';
          c.fillText('💥', x + 18, y + 33);
        }
      } else {
        c.fillStyle = '#334155';
        c.shadowColor = '#475569';
        c.fillRect(x, y, 54, 54);
      }
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;
    const me = e as any;
    const rect = me.currentTarget?.getBoundingClientRect();
    if (rect) {
      let cx = 0, cy = 0;
      if (me.clientX !== undefined) {
        cx = me.clientX - rect.left; cy = me.clientY - rect.top;
      } else if (me.touches && me.touches[0]) {
        cx = me.touches[0].clientX - rect.left; cy = me.touches[0].clientY - rect.top;
      }

      s.grid.forEach((cell: any, i: number) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const x = 50 + col * 64;
        const y = 50 + row * 64;

        if (cx >= x && cx <= x + 54 && cy >= y && cy <= y + 54) {
          if (!cell.revealed) {
            cell.revealed = true;
            if (cell.isMine) {
              ctx.onDamage();
              addParticles(cx, cy, '#ef4444', 20);
              // Restart Sweeper
              setTimeout(() => {
                MineGame.init(ctx);
              }, 1000);
            } else {
              ctx.onCoin(6);
              addParticles(cx, cy, '#38bdf8', 8);

              // Auto-restart if all safe cells revealed
              if (s.grid.every((cl: any) => cl.isMine || cl.revealed)) {
                setTimeout(() => {
                  MineGame.init(ctx);
                }, 1000);
              }
            }
          }
        }
      });
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 13: HELIX FALL
// ==========================================
const HelixGame: MiniGame = {
  id: 'helix',
  name: 'Neon Helix',
  icon: 'Circle',
  description: 'Rotate the platforms. Fall down gaps and avoid orange sectors!',
  controls: 'A/D or Drag horizontally to spin the tower.',
  init: (ctx) => {
    ctx.savedState = {
      ballY: 100,
      ballVY: 0,
      angle: 0, // platform spin angle
      platforms: [
        { y: 150, gapStart: 0, gapEnd: 1.2 },
        { y: 250, gapStart: 2, gapEnd: 3.2 },
        { y: 350, gapStart: 4, gapEnd: 5.2 },
      ],
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.ballVY += 0.2; // gravity
    s.ballY += s.ballVY;

    // Boundary bounce
    if (s.ballY > 390) {
      s.ballY = 390;
      s.ballVY = -5;
    }

    s.platforms.forEach((p: any) => {
      // Check collision when passing platform height
      if (s.ballY >= p.y - 6 && s.ballY <= p.y + 6 && s.ballVY > 0) {
        // Evaluate if angle is inside gap
        const normAngle = (s.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const withinGap = normAngle >= p.gapStart && normAngle <= p.gapEnd;

        if (withinGap) {
          // Slide through!
          ctx.onCoin(10);
          addParticles(200, p.y, '#10b981', 12);
        } else {
          // Bounce or die if orange? Let's treat orange zones as damage
          s.ballY = p.y - 6;
          s.ballVY = -5.5; // bounce back
          // If hit red sector
          if (normAngle > p.gapEnd && normAngle < p.gapEnd + 1.2) {
            ctx.onDamage();
            addParticles(200, p.y, '#ef4444', 15);
          }
        }
      }
    });
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw central column
    c.fillStyle = '#1e293b';
    c.fillRect(190, 0, 20, 400);

    // Draw platforms
    s.platforms.forEach((p: any) => {
      c.save();
      c.translate(200, p.y);
      c.rotate(-s.angle);

      // Main Sector
      c.strokeStyle = '#06b6d4';
      c.lineWidth = 10;
      c.shadowColor = '#06b6d4';
      c.shadowBlur = 6;
      c.beginPath();
      c.arc(0, 0, 70, p.gapEnd, p.gapStart + Math.PI * 2);
      c.stroke();

      // Hazard sector
      c.strokeStyle = '#f43f5e';
      c.beginPath();
      c.arc(0, 0, 70, p.gapEnd, p.gapEnd + 1.2);
      c.stroke();

      c.restore();
    });

    // Draw Ball
    c.fillStyle = '#f59e0b';
    c.shadowColor = '#f59e0b';
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(200, s.ballY, 10, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (e.type === 'keydown') {
      const key = (e as KeyboardEvent).key;
      if (key === 'ArrowLeft' || key === 'a') s.angle -= 0.15;
      if (key === 'ArrowRight' || key === 'd') s.angle += 0.15;
    } else if (e.type === 'move') {
      const me = e as any;
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        let x = 0;
        if (me.clientX !== undefined) x = me.clientX - rect.left;
        else if (me.touches && me.touches[0]) x = me.touches[0].clientX - rect.left;
        s.angle = (x / 400) * Math.PI * 2;
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 14: CROSSY ROAD
// ==========================================
const CrossyGame: MiniGame = {
  id: 'crossy',
  name: 'Cyber Crossy',
  icon: 'Compass',
  description: 'Reach the green mainframe. Stay clear of fast neon lanes!',
  controls: 'Arrow keys or TAP top/bottom/left/right of screen.',
  init: (ctx) => {
    ctx.savedState = {
      playerY: 360,
      playerX: 200,
      step: 40,
      lanes: [
        { y: 80, speed: 2, carX: 0, w: 40, col: '#f43f5e' },
        { y: 160, speed: -3, carX: 300, w: 40, col: '#a855f7' },
        { y: 240, speed: 1.5, carX: 100, w: 50, col: '#ec4899' },
        { y: 300, speed: -2.5, carX: 200, w: 35, col: '#eab308' },
      ],
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;

    s.lanes.forEach((lane: any) => {
      lane.carX += lane.speed;
      if (lane.carX < -80) lane.carX = 400;
      if (lane.carX > 400) lane.carX = -80;

      // Crash check
      if (s.playerY >= lane.y - 15 && s.playerY <= lane.y + 15) {
        if (s.playerX + 12 > lane.carX && s.playerX - 12 < lane.carX + lane.w) {
          ctx.onDamage();
          addParticles(s.playerX, s.playerY, '#ef4444', 15);
          s.playerY = 360;
          s.playerX = 200;
        }
      }
    });

    // Reach end Mainframe
    if (s.playerY < 40) {
      ctx.onCoin(15);
      addParticles(200, 40, '#10b981', 20);
      s.playerY = 360;
      s.playerX = 200;
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw safe goal top
    c.fillStyle = 'rgba(16, 185, 129, 0.2)';
    c.fillRect(0, 0, 400, 45);

    // Goal border
    c.strokeStyle = '#10b981';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 45); c.lineTo(400, 45);
    c.stroke();

    // Lanes drawing
    s.lanes.forEach((lane: any) => {
      c.fillStyle = '#1e293b';
      c.fillRect(0, lane.y - 20, 400, 40);

      // Car
      c.fillStyle = lane.col;
      c.shadowColor = lane.col;
      c.shadowBlur = 10;
      c.fillRect(lane.carX, lane.y - 12, lane.w, 24);
    });

    // Draw Player frog (Neon cyan)
    c.fillStyle = '#06b6d4';
    c.shadowColor = '#06b6d4';
    c.shadowBlur = 12;
    c.beginPath();
    c.arc(s.playerX, s.playerY, 12, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;

    if ((e as KeyboardEvent).key) {
      const key = (e as KeyboardEvent).key;
      if (key === 'ArrowUp' || key === 'w') s.playerY -= s.step;
      if (key === 'ArrowDown' || key === 's') s.playerY = Math.min(360, s.playerY + s.step);
      if (key === 'ArrowLeft' || key === 'a') s.playerX = Math.max(15, s.playerX - s.step);
      if (key === 'ArrowRight' || key === 'd') s.playerX = Math.min(385, s.playerX + s.step);
    } else {
      // Tap control: relative
      const me = e as any;
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        let tx = 0, ty = 0;
        if (me.clientX !== undefined) {
          tx = me.clientX - rect.left; ty = me.clientY - rect.top;
        } else if (me.touches && me.touches[0]) {
          tx = me.touches[0].clientX - rect.left; ty = me.touches[0].clientY - rect.top;
        }

        const dx = tx - s.playerX;
        const dy = ty - s.playerY;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) s.playerX = Math.min(385, s.playerX + s.step);
          else s.playerX = Math.max(15, s.playerX - s.step);
        } else {
          if (dy > 0) s.playerY = Math.min(360, s.playerY + s.step);
          else s.playerY -= s.step;
        }
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 15: BLOCK STACKER
// ==========================================
const StackerGame: MiniGame = {
  id: 'stacker',
  name: 'Core Stacker',
  icon: 'Layers',
  description: 'Stack moving blocks precisely on top of each other. Perfect stack yields mega coins!',
  controls: 'Space or Click to Drop block.',
  init: (ctx) => {
    ctx.savedState = {
      level: 0,
      width: 150,
      x: 0,
      vx: 3,
      rows: [] as any[], // stacked rows: {y, x, w}
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.x += s.vx;
    if (s.x < 0) { s.x = 0; s.vx = -s.vx; }
    if (s.x + s.width > 400) { s.x = 400 - s.width; s.vx = -s.vx; }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw active moving block
    c.fillStyle = '#ec4899';
    c.shadowColor = '#ec4899';
    c.shadowBlur = 10;
    const activeY = 340 - s.level * 25;
    c.fillRect(s.x, activeY, s.width, 20);

    // Draw existing stack
    s.rows.forEach((row: any) => {
      c.fillStyle = '#db2777';
      c.shadowColor = '#db2777';
      c.fillRect(row.x, row.y, row.w, 20);
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;
    const activeY = 340 - s.level * 25;

    if (s.level === 0) {
      // First row, free pass
      s.rows.push({ y: activeY, x: s.x, w: s.width });
      s.level++;
      ctx.onCoin(5);
    } else {
      const prev = s.rows[s.rows.length - 1];
      // Check overlap
      const overlapX = Math.max(s.x, prev.x);
      const overlapRight = Math.min(s.x + s.width, prev.x + prev.w);
      const overlapW = overlapRight - overlapX;

      if (overlapW > 0) {
        // Stack succeeds
        s.width = overlapW;
        s.x = overlapX;
        s.rows.push({ y: activeY, x: s.x, w: s.width });
        s.level++;
        ctx.onCoin(8);
        addParticles(s.x + s.width / 2, activeY, '#ec4899', 8);

        if (s.level >= 12) {
          // Finish tower!
          ctx.onCoin(50);
          addParticles(200, 200, '#eab308', 25);
          s.level = 0;
          s.width = 150;
          s.rows = [];
        }
      } else {
        // Miss!
        ctx.onDamage();
        addParticles(s.x + s.width / 2, activeY, '#ef4444', 18);
        s.level = 0;
        s.width = 150;
        s.rows = [];
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 16: SPACE DEFENSE
// ==========================================
const InvadersGame: MiniGame = {
  id: 'invaders',
  name: 'Cyber Invaders',
  icon: 'Shield',
  description: 'Shoot down incoming rows of bugs. Keep them from landing!',
  controls: 'A/D or mouse movement, Space to shoot.',
  init: (ctx) => {
    const bugs = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        bugs.push({ x: 50 + c * 50, y: 50 + r * 30, alive: true, w: 20, h: 15 });
      }
    }
    ctx.savedState = {
      playerX: 200,
      bullets: [],
      bugs,
      bugDir: 1,
      bugStepDown: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;

    // Move bullets
    s.bullets.forEach((b: any, bIndex: number) => {
      b.y -= 5;
      if (b.y < 0) s.bullets.splice(bIndex, 1);
    });

    // Move bug group
    let hitEdge = false;
    s.bugs.forEach((b: any) => {
      if (b.alive) {
        b.x += s.bugDir * 0.8;
        if (b.x < 15 || b.x > 385) hitEdge = true;

        // Check landing/crash
        if (b.y > 330) {
          ctx.onDamage();
          addParticles(200, 200, '#ef4444', 15);
          InvadersGame.init(ctx);
        }
      }
    });

    if (hitEdge) {
      s.bugDir = -s.bugDir;
      s.bugs.forEach((b: any) => b.y += 15);
    }

    // Bullet hit checks
    s.bullets.forEach((b: any, bIndex: number) => {
      s.bugs.forEach((bug: any) => {
        if (bug.alive && b.x > bug.x - 10 && b.x < bug.x + 10 && b.y > bug.y - 8 && b.y < bug.y + 8) {
          bug.alive = false;
          s.bullets.splice(bIndex, 1);
          ctx.onCoin(6);
          addParticles(bug.x, bug.y, '#10b981', 12);
        }
      });
    });

    // Reload if all dead
    if (s.bugs.every((b: any) => !b.alive)) {
      InvadersGame.init(ctx);
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw bugs
    c.fillStyle = '#10b981';
    c.shadowColor = '#10b981';
    s.bugs.forEach((bug: any) => {
      if (bug.alive) {
        c.shadowBlur = 6;
        c.fillRect(bug.x - 10, bug.y - 8, 20, 16);
      }
    });

    // Player cannon
    c.fillStyle = '#059669';
    c.shadowColor = '#059669';
    c.shadowBlur = 10;
    c.fillRect(s.playerX - 15, 365, 30, 15);
    c.fillRect(s.playerX - 3, 355, 6, 10);

    // Bullets
    c.fillStyle = '#34d399';
    s.bullets.forEach((b: any) => {
      c.fillRect(b.x - 2, b.y, 4, 10);
    });
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    const s = ctx.savedState;
    if (e.type === 'keydown') {
      const key = (e as KeyboardEvent).key;
      if (key === 'ArrowLeft' || key === 'a') s.playerX = Math.max(20, s.playerX - 15);
      if (key === 'ArrowRight' || key === 'd') s.playerX = Math.min(380, s.playerX + 15);
      if (key === ' ') {
        s.bullets.push({ x: s.playerX, y: 350 });
      }
    } else if (e.type === 'move') {
      const me = e as any;
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        let mx = 0;
        if (me.clientX !== undefined) mx = me.clientX - rect.left;
        else if (me.touches && me.touches[0]) mx = me.touches[0].clientX - rect.left;
        s.playerX = Math.max(20, Math.min(380, mx));
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 17: HYPER TAP
// ==========================================
const TapGame: MiniGame = {
  id: 'hypertap',
  name: 'Hyper Tap',
  icon: 'CircleDot',
  description: 'Tap shrinking cyber-nodes before they vanish. Missing them costs a heart!',
  controls: 'Tap the targets instantly.',
  init: (ctx) => {
    ctx.savedState = {
      targetX: 200,
      targetY: 200,
      size: 40,
      maxSize: 40,
      timer: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.size -= 0.5;

    if (s.size <= 0) {
      // Missed completely!
      ctx.onDamage();
      addParticles(s.targetX, s.targetY, '#ef4444', 15);
      // Respawn random
      s.targetX = 50 + Math.random() * 300;
      s.targetY = 50 + Math.random() * 300;
      s.size = s.maxSize;
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    c.strokeStyle = '#a855f7';
    c.shadowColor = '#a855f7';
    c.shadowBlur = 12;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(s.targetX, s.targetY, s.size, 0, Math.PI * 2);
    c.stroke();

    // Solid inner core
    c.fillStyle = '#ec4899';
    c.beginPath();
    c.arc(s.targetX, s.targetY, Math.max(2, s.size - 10), 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;
    const me = e as any;
    const rect = me.currentTarget?.getBoundingClientRect();
    if (rect) {
      let cx = 0, cy = 0;
      if (me.clientX !== undefined) {
        cx = me.clientX - rect.left; cy = me.clientY - rect.top;
      } else if (me.touches && me.touches[0]) {
        cx = me.touches[0].clientX - rect.left; cy = me.touches[0].clientY - rect.top;
      }

      if (Math.hypot(s.targetX - cx, s.targetY - cy) < s.size + 10) {
        // Hit!
        ctx.onCoin(10);
        addParticles(s.targetX, s.targetY, '#ec4899', 15);

        s.targetX = 50 + Math.random() * 300;
        s.targetY = 50 + Math.random() * 300;
        s.size = s.maxSize;
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 18: LABYRINTH ESCAPE
// ==========================================
const LabyrinthGame: MiniGame = {
  id: 'labyrinth',
  name: 'Cyber Escape',
  icon: 'Navigation',
  description: 'Navigate through grid walls to the neon portal. Avoid security hazards!',
  controls: 'Arrow Keys or Click target coordinates to slide ball.',
  init: (ctx) => {
    ctx.savedState = {
      px: 30, py: 30,
      portalX: 340, portalY: 340,
      walls: [
        { x: 100, y: 0, w: 20, h: 250 },
        { x: 200, y: 150, w: 20, h: 250 },
        { x: 280, y: 0, w: 20, h: 200 },
      ],
      hazardY: 100,
      hazardDir: 1,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.hazardY += s.hazardDir * 3;
    if (s.hazardY < 50 || s.hazardY > 350) {
      s.hazardDir = -s.hazardDir;
    }

    // Hazard collision
    if (Math.hypot(150 - s.px, s.hazardY - s.py) < 20) {
      ctx.onDamage();
      addParticles(s.px, s.py, '#ef4444', 15);
      s.px = 30; s.py = 30;
    }

    // Portal reach
    if (Math.hypot(s.portalX - s.px, s.portalY - s.py) < 20) {
      ctx.onCoin(20);
      addParticles(s.portalX, s.portalY, '#22d3ee', 22);
      s.px = 30; s.py = 30;
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw walls
    c.fillStyle = '#1e293b';
    c.strokeStyle = '#475569';
    c.lineWidth = 1;
    s.walls.forEach((w: any) => {
      c.fillRect(w.x, w.y, w.w, w.h);
      c.strokeRect(w.x, w.y, w.w, w.h);
    });

    // Draw hazard
    c.fillStyle = '#ef4444';
    c.shadowColor = '#ef4444';
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(150, s.hazardY, 10, 0, Math.PI * 2);
    c.fill();

    // Portal (Neon cyan)
    c.fillStyle = '#22d3ee';
    c.shadowColor = '#22d3ee';
    c.beginPath();
    c.arc(s.portalX, s.portalY, 15, 0, Math.PI * 2);
    c.fill();

    // Player (Neon pink)
    c.fillStyle = '#ec4899';
    c.shadowColor = '#ec4899';
    c.beginPath();
    c.arc(s.px, s.py, 10, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;
    const me = e as any;

    if (me.key) {
      const key = me.key;
      let nx = s.px, ny = s.py;
      if (key === 'ArrowUp' || key === 'w') ny -= 15;
      if (key === 'ArrowDown' || key === 's') ny += 15;
      if (key === 'ArrowLeft' || key === 'a') nx -= 15;
      if (key === 'ArrowRight' || key === 'd') nx += 15;

      // Wall hit collision
      let hits = false;
      s.walls.forEach((w: any) => {
        if (nx + 8 > w.x && nx - 8 < w.x + w.w && ny + 8 > w.y && ny - 8 < w.y + w.h) {
          hits = true;
        }
      });

      if (!hits) {
        s.px = Math.max(15, Math.min(385, nx));
        s.py = Math.max(15, Math.min(385, ny));
      }
    } else {
      // Tap relative move
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        let tx = 0, ty = 0;
        if (me.clientX !== undefined) {
          tx = me.clientX - rect.left; ty = me.clientY - rect.top;
        } else if (me.touches && me.touches[0]) {
          tx = me.touches[0].clientX - rect.left; ty = me.touches[0].clientY - rect.top;
        }
        const dx = tx - s.px;
        const dy = ty - s.py;
        let nx = s.px, ny = s.py;
        if (Math.abs(dx) > Math.abs(dy)) nx += dx > 0 ? 15 : -15;
        else ny += dy > 0 ? 15 : -15;

        let hits = false;
        s.walls.forEach((w: any) => {
          if (nx + 8 > w.x && nx - 8 < w.x + w.w && ny + 8 > w.y && ny - 8 < w.y + w.h) {
            hits = true;
          }
        });
        if (!hits) {
          s.px = Math.max(15, Math.min(385, nx));
          s.py = Math.max(15, Math.min(385, ny));
        }
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 19: PACMAN DOT GRID
// ==========================================
const PacmanGame: MiniGame = {
  id: 'pacman',
  name: 'Cyber Pac',
  icon: 'Flame',
  description: 'Dodge the chaser. Eat yellow grid bits to score.',
  controls: 'Arrow keys or Swipe screen.',
  init: (ctx) => {
    const dots = [];
    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= 4; c++) {
        dots.push({ x: c * 80, y: r * 80, active: true });
      }
    }
    ctx.savedState = {
      px: 200, py: 200,
      gx: 50, gy: 50,
      dots,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;

    // Ghost moves to player slowly
    const gdx = s.px - s.gx;
    const gdy = s.py - s.gy;
    const gdist = Math.hypot(gdx, gdy);
    if (gdist > 0) {
      s.gx += (gdx / gdist) * 1.3;
      s.gy += (gdy / gdist) * 1.3;
    }

    // Ghost crash
    if (Math.hypot(s.gx - s.px, s.gy - s.py) < 16) {
      ctx.onDamage();
      addParticles(s.px, s.py, '#ef4444', 15);
      s.px = 200; s.py = 200; s.gx = 50; s.gy = 50;
    }

    // Eating dots
    s.dots.forEach((d: any) => {
      if (d.active && Math.hypot(d.x - s.px, d.y - s.py) < 15) {
        d.active = false;
        ctx.onCoin(6);
        addParticles(d.x, d.y, '#eab308', 8);
      }
    });

    if (s.dots.every((d: any) => !d.active)) {
      s.dots.forEach((d: any) => d.active = true);
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw dots
    c.fillStyle = '#facc15';
    c.shadowColor = '#facc15';
    s.dots.forEach((d: any) => {
      if (d.active) {
        c.shadowBlur = 6;
        c.beginPath();
        c.arc(d.x, d.y, 6, 0, Math.PI * 2);
        c.fill();
      }
    });

    // Draw Ghost (Red)
    c.fillStyle = '#ef4444';
    c.shadowColor = '#ef4444';
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(s.gx, s.gy, 12, 0, Math.PI * 2);
    c.fill();

    // Draw Pac (Yellow circle with mouth)
    c.fillStyle = '#eab308';
    c.shadowColor = '#eab308';
    c.beginPath();
    c.arc(s.px, s.py, 12, 0.2, Math.PI * 2 - 0.2);
    c.lineTo(s.px, s.py);
    c.fill();
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'down') return;
    const s = ctx.savedState;
    const me = e as any;

    if (me.key) {
      const key = me.key;
      if (key === 'ArrowUp' || key === 'w') s.py = Math.max(15, s.py - 15);
      if (key === 'ArrowDown' || key === 's') s.py = Math.min(385, s.py + 15);
      if (key === 'ArrowLeft' || key === 'a') s.px = Math.max(15, s.px - 15);
      if (key === 'ArrowRight' || key === 'd') s.px = Math.min(385, s.px + 15);
    } else {
      const rect = me.currentTarget?.getBoundingClientRect();
      if (rect) {
        let tx = 0, ty = 0;
        if (me.clientX !== undefined) {
          tx = me.clientX - rect.left; ty = me.clientY - rect.top;
        } else if (me.touches && me.touches[0]) {
          tx = me.touches[0].clientX - rect.left; ty = me.touches[0].clientY - rect.top;
        }
        const dx = tx - s.px;
        const dy = ty - s.py;
        if (Math.abs(dx) > Math.abs(dy)) s.px += dx > 0 ? 15 : -15;
        else s.py += dy > 0 ? 15 : -15;

        s.px = Math.max(15, Math.min(385, s.px));
        s.py = Math.max(15, Math.min(385, s.py));
      }
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// GAME 20: GRID PUZZLE (TETRIS LITE)
// ==========================================
const TetrisGame: MiniGame = {
  id: 'tetris',
  name: 'Retro Tetris',
  icon: 'Table',
  description: 'Align the falling columns. Clean rows before they stack to the ceiling!',
  controls: 'A/D to move left/right, S to slide faster.',
  init: (ctx) => {
    ctx.savedState = {
      grid: Array(10).fill(0).map(() => Array(12).fill(null)),
      blockX: 4,
      blockY: 0,
      blockColor: '#22d3ee',
      fallTimer: 0,
    };
  },
  update: (ctx) => {
    const s = ctx.savedState;
    s.fallTimer++;
    if (s.fallTimer >= 35) {
      s.fallTimer = 0;

      // Fall down
      if (s.blockY < 11 && !s.grid[s.blockX][s.blockY + 1]) {
        s.blockY++;
      } else {
        // Lock grid
        s.grid[s.blockX][s.blockY] = s.blockColor;

        // Clear line checks (simplified columns or bottom rows)
        let cleared = false;
        // If bottom rows match color
        for (let y = 11; y >= 0; y--) {
          let full = true;
          for (let x = 0; x < 10; x++) {
            if (!s.grid[x][y]) full = false;
          }
          if (full) {
            cleared = true;
            ctx.onCoin(30);
            addParticles(200, y * 30 + 15, '#22d3ee', 25);
            // shift down
            for (let x = 0; x < 10; x++) {
              for (let sy = y; sy > 0; sy--) {
                s.grid[x][sy] = s.grid[x][sy - 1];
              }
              s.grid[x][0] = null;
            }
            y++; // check same row again
          }
        }

        if (!cleared) {
          ctx.onCoin(2); // small coin on lock
        }

        // New block
        s.blockX = 4;
        s.blockY = 0;
        s.blockColor = Math.random() > 0.5 ? '#22d3ee' : '#ec4899';

        // Roof game over
        if (s.grid[s.blockX][s.blockY]) {
          ctx.onDamage();
          addParticles(200, 100, '#ef4444', 20);
          s.grid = Array(10).fill(0).map(() => Array(12).fill(null));
        }
      }
    }
  },
  draw: (ctx) => {
    const s = ctx.savedState;
    const c = ctx.ctx;

    // Draw active column block
    c.fillStyle = s.blockColor;
    c.shadowColor = s.blockColor;
    c.shadowBlur = 8;
    c.fillRect(s.blockX * 36 + 20, s.blockY * 30 + 20, 32, 26);

    // Draw locked blocks
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 12; y++) {
        const col = s.grid[x][y];
        if (col) {
          c.fillStyle = col;
          c.shadowColor = col;
          c.fillRect(x * 36 + 20, y * 30 + 20, 32, 26);
        }
      }
    }
    c.shadowBlur = 0;
  },
  handleInput: (ctx, e) => {
    if (e.type !== 'keydown') return;
    const s = ctx.savedState;
    const key = (e as KeyboardEvent).key;

    if ((key === 'ArrowLeft' || key === 'a') && s.blockX > 0 && !s.grid[s.blockX - 1][s.blockY]) {
      s.blockX--;
    }
    if ((key === 'ArrowRight' || key === 'd') && s.blockX < 9 && !s.grid[s.blockX + 1][s.blockY]) {
      s.blockX++;
    }
    if (key === 'ArrowDown' || key === 's') {
      s.fallTimer = 99; // trigger faster drop
    }
  },
  pause: (ctx) => ctx.savedState,
  resume: (ctx, saved) => { ctx.savedState = saved; },
  cleanup: () => {},
};

// ==========================================
// REGISTRY EXPORT
// ==========================================
export const ALL_MINI_GAMES: MiniGame[] = [
  SnakeGame,      // 1
  PongGame,       // 2
  FlappyGame,     // 3
  ArcherGame,     // 4
  AsteroidGame,   // 5
  BrickGame,      // 6
  DinoGame,       // 7
  SimonGame,      // 8
  SlicerGame,     // 9
  MemoryGame,     // 10
  WhackGame,      // 11
  MineGame,       // 12
  HelixGame,      // 13
  CrossyGame,     // 14
  StackerGame,    // 15
  InvadersGame,   // 16
  TapGame,        // 17
  LabyrinthGame,  // 18
  PacmanGame,     // 19
  TetrisGame,     // 20
];

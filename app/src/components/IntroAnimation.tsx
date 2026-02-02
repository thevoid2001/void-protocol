import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showText, setShowText] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 500;

    // Create face shape points
    const facePoints: [number, number][] = [];

    // Face outline (oval)
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const rx = 70 * scale;
      const ry = 90 * scale;
      facePoints.push([Math.cos(a) * rx, Math.sin(a) * ry - 10 * scale]);
    }

    // Left eye
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      facePoints.push([
        -25 * scale + Math.cos(a) * 12 * scale,
        -20 * scale + Math.sin(a) * 6 * scale
      ]);
    }
    // Left pupil
    facePoints.push([-25 * scale, -20 * scale]);

    // Right eye
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      facePoints.push([
        25 * scale + Math.cos(a) * 12 * scale,
        -20 * scale + Math.sin(a) * 6 * scale
      ]);
    }
    // Right pupil
    facePoints.push([25 * scale, -20 * scale]);

    // Eyebrows
    for (let x = -38; x < -12; x += 4) {
      facePoints.push([x * scale, -38 * scale]);
    }
    for (let x = 12; x < 38; x += 4) {
      facePoints.push([x * scale, -38 * scale]);
    }

    // Nose
    for (let y = -10; y < 15; y += 5) {
      facePoints.push([0, y * scale]);
    }
    facePoints.push([-8 * scale, 15 * scale]);
    facePoints.push([8 * scale, 15 * scale]);

    // Mouth
    for (let a = 0; a < Math.PI; a += 0.2) {
      facePoints.push([
        Math.cos(a) * 20 * scale,
        35 * scale + Math.sin(a) * 8 * scale
      ]);
    }

    // Create logo shape points (the void circle with gap)
    const logoPoints: [number, number][] = [];
    const logoRadius = 60 * scale;

    // Circle with gap at bottom
    for (let a = -Math.PI * 0.8; a < Math.PI * 0.8; a += 0.1) {
      logoPoints.push([
        Math.cos(a - Math.PI / 2) * logoRadius,
        Math.sin(a - Math.PI / 2) * logoRadius
      ]);
    }

    // Inner details (stylized V shape)
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      logoPoints.push([
        (-20 + t * 20) * scale,
        (-10 + t * 30) * scale
      ]);
      logoPoints.push([
        (20 - t * 20) * scale,
        (-10 + t * 30) * scale
      ]);
    }

    // Create particles - one for each face point
    const particles: Particle[] = facePoints.map(([fx, fy], i) => {
      // Map to corresponding logo point (or random if more face points)
      const logoIdx = i % logoPoints.length;
      const [lx, ly] = logoPoints[logoIdx];

      return {
        x: centerX + fx,
        y: centerY + fy,
        targetX: centerX + lx,
        targetY: centerY + ly,
        vx: 0,
        vy: 0,
        size: 2 + Math.random() * 2,
        alpha: 1,
      };
    });

    // Add extra particles for density
    for (let i = 0; i < 100; i++) {
      const faceIdx = Math.floor(Math.random() * facePoints.length);
      const logoIdx = Math.floor(Math.random() * logoPoints.length);
      const [fx, fy] = facePoints[faceIdx];
      const [lx, ly] = logoPoints[logoIdx];

      particles.push({
        x: centerX + fx + (Math.random() - 0.5) * 10,
        y: centerY + fy + (Math.random() - 0.5) * 10,
        targetX: centerX + lx + (Math.random() - 0.5) * 5,
        targetY: centerY + ly + (Math.random() - 0.5) * 5,
        vx: 0,
        vy: 0,
        size: 1 + Math.random() * 1.5,
        alpha: 0.6 + Math.random() * 0.4,
      });
    }

    let frame = 0;
    const holdFace = 90; // frames showing face
    const morphDuration = 120; // frames to morph to logo
    const holdLogo = 60; // frames showing logo

    const animate = () => {
      // Dark background
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frame++;

      particles.forEach((p) => {
        if (frame <= holdFace) {
          // Just show face with subtle movement
          p.x += (Math.random() - 0.5) * 0.5;
          p.y += (Math.random() - 0.5) * 0.5;
        } else if (frame <= holdFace + morphDuration) {
          // Morph to logo
          const progress = (frame - holdFace) / morphDuration;
          const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          // First scatter outward, then converge to logo
          if (progress < 0.3) {
            // Scatter phase
            if (p.vx === 0 && p.vy === 0) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 2 + Math.random() * 4;
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
            }
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.alpha = 0.3 + Math.random() * 0.3;
          } else {
            // Converge to logo
            const convergeProgress = (progress - 0.3) / 0.7;
            p.x += (p.targetX - p.x) * 0.05;
            p.y += (p.targetY - p.y) * 0.05;
            p.alpha = 0.5 + convergeProgress * 0.5;
          }
        } else if (frame <= holdFace + morphDuration + holdLogo) {
          // Hold logo with subtle pulse
          const pulse = Math.sin(frame * 0.1) * 2;
          const dx = p.targetX - centerX;
          const dy = p.targetY - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          p.x = p.targetX + (dx / dist) * pulse;
          p.y = p.targetY + (dy / dist) * pulse;
          p.alpha = 1;
        } else {
          // Fade out
          p.alpha *= 0.95;
        }

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 209, 255, ${p.alpha})`;
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 209, 255, ${p.alpha * 0.2})`;
        ctx.fill();
      });

      // Show text after logo forms
      if (frame === holdFace + morphDuration + 20) {
        setShowText(true);
      }

      // Trigger fade out
      if (frame >= holdFace + morphDuration + holdLogo) {
        setFadeOut(true);
        setTimeout(onComplete, 800);
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-700 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Text overlay */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
          showText ? "opacity-100" : "opacity-0"
        }`}
        style={{ paddingTop: "180px" }}
      >
        <h1 className="text-3xl font-semibold tracking-widest">
          <span className="text-white">VOID</span>{" "}
          <span className="text-[#666]">PROTOCOL</span>
        </h1>
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-xs text-[#333] hover:text-[#666] transition z-10"
      >
        Skip
      </button>
    </div>
  );
}

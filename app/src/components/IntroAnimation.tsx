import { useEffect, useRef, useState } from "react";

interface CodeChar {
  x: number;
  y: number;
  char: string;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  speed: number;
  phase: "rain" | "hold" | "converge" | "logo";
}

// Matrix-style characters
const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF{}[]<>/\\|@#$%&*";

export function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const logoRadius = Math.min(canvas.width, canvas.height) * 0.15;

    const chars: CodeChar[] = [];
    const columns = Math.floor(canvas.width / 20);
    const rows = Math.floor(canvas.height / 20);

    // Create code characters in a grid that will rain down
    for (let col = 0; col < columns; col++) {
      const x = col * 20 + 10;
      // Stagger start positions above screen
      for (let row = 0; row < rows + 20; row++) {
        const startY = -row * 20 - Math.random() * 500;
        const finalY = row * 20;

        // Calculate if this position should be part of the logo circle
        const dx = x - centerX;
        const dy = finalY - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        const isOnRing = distFromCenter > logoRadius - 8 && distFromCenter < logoRadius + 8;

        chars.push({
          x: x,
          y: startY,
          char: CHARS[Math.floor(Math.random() * CHARS.length)],
          targetX: isOnRing ? x : centerX + (Math.random() - 0.5) * 50,
          targetY: isOnRing ? finalY : centerY + (Math.random() - 0.5) * 50,
          vx: 0,
          vy: 0,
          alpha: 0.8 + Math.random() * 0.2,
          size: 14 + Math.random() * 4,
          speed: 8 + Math.random() * 12,
          phase: "rain",
        });
      }
    }

    // Create extra particles specifically for the logo ring
    const ringParticles = 200;
    for (let i = 0; i < ringParticles; i++) {
      const angle = (i / ringParticles) * Math.PI * 2;
      const ringX = centerX + Math.cos(angle) * logoRadius;
      const ringY = centerY + Math.sin(angle) * logoRadius;

      chars.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * 1000,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        targetX: ringX,
        targetY: ringY,
        vx: 0,
        vy: 0,
        alpha: 1,
        size: 12,
        speed: 10 + Math.random() * 8,
        phase: "rain",
      });
    }

    let frame = 0;
    const rainDuration = 80;
    const holdDuration = 40;
    const convergeDuration = 100;
    const logoDuration = 80;

    const animate = () => {
      // Black background with slight trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frame++;

      // Determine global phase
      let globalPhase: "rain" | "hold" | "converge" | "logo";
      if (frame <= rainDuration) {
        globalPhase = "rain";
      } else if (frame <= rainDuration + holdDuration) {
        globalPhase = "hold";
      } else if (frame <= rainDuration + holdDuration + convergeDuration) {
        globalPhase = "converge";
      } else {
        globalPhase = "logo";
      }

      // Clear for logo phase (no trails)
      if (globalPhase === "logo") {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      chars.forEach((c) => {
        if (globalPhase === "rain") {
          // Rain down
          c.y += c.speed;
          // Random character flicker
          if (Math.random() < 0.05) {
            c.char = CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        } else if (globalPhase === "hold") {
          // Hold with subtle flicker
          if (Math.random() < 0.02) {
            c.char = CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        } else if (globalPhase === "converge") {
          // Converge to logo
          const progress = (frame - rainDuration - holdDuration) / convergeDuration;

          // Check if this char should be part of the ring
          const dx = c.targetX - centerX;
          const dy = c.targetY - centerY;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          const isRingParticle = Math.abs(distFromCenter - logoRadius) < 15;

          if (isRingParticle) {
            // Move towards ring position
            c.x += (c.targetX - c.x) * 0.08;
            c.y += (c.targetY - c.y) * 0.08;
            c.alpha = 0.5 + progress * 0.5;
          } else {
            // Fade out non-ring characters
            c.alpha *= 0.95;
            // Drift towards center then fade
            c.x += (centerX - c.x) * 0.02;
            c.y += (centerY - c.y) * 0.02;
          }
        } else {
          // Logo phase - only show ring particles
          const dx = c.targetX - centerX;
          const dy = c.targetY - centerY;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          const isRingParticle = Math.abs(distFromCenter - logoRadius) < 15;

          if (isRingParticle) {
            c.x = c.targetX;
            c.y = c.targetY;
            c.alpha = 1;
          } else {
            c.alpha = 0;
          }
        }

        // Draw character
        if (c.alpha > 0.01) {
          ctx.font = `${c.size}px monospace`;
          ctx.fillStyle =
            globalPhase === "logo"
              ? `rgba(100, 200, 255, ${c.alpha})`
              : `rgba(0, 200, 100, ${c.alpha * 0.8})`;
          ctx.fillText(c.char, c.x, c.y);
        }
      });

      // Draw the actual logo in logo phase
      if (globalPhase === "logo") {
        const logoProgress = (frame - rainDuration - holdDuration - convergeDuration) / logoDuration;
        const glowAlpha = Math.min(1, logoProgress * 2);

        // Outer glow
        const gradient = ctx.createRadialGradient(
          centerX, centerY, logoRadius * 0.8,
          centerX, centerY, logoRadius * 1.4
        );
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.5, `rgba(100, 200, 255, ${0.1 * glowAlpha})`);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.8 * glowAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner void
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoRadius - 3, 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();

        // Text
        if (logoProgress > 0.3) {
          const textAlpha = Math.min(1, (logoProgress - 0.3) * 2);
          ctx.font = "600 32px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
          ctx.textAlign = "center";
          ctx.fillText("VOID", centerX, centerY + logoRadius + 50);

          ctx.font = "300 12px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = `rgba(80, 80, 80, ${textAlpha})`;
          ctx.letterSpacing = "4px";
          ctx.fillText("PROTOCOL", centerX, centerY + logoRadius + 70);
        }
      }

      // End animation
      if (frame >= rainDuration + holdDuration + convergeDuration + logoDuration) {
        setFadeOut(true);
        setTimeout(onComplete, 600);
        return;
      }

      requestAnimationFrame(animate);
    };

    // Start with clear black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animate();
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-xs text-[#333] hover:text-[#666] transition z-10"
      >
        Skip
      </button>
    </div>
  );
}

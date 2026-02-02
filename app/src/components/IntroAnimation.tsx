import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: "form" | "hold" | "scatter" | "fade";
}

export function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"intro" | "scatter" | "text" | "done">("intro");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create figure shape (stylized human silhouette made of points)
    const figurePoints: [number, number][] = [];

    // Head (circle)
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      figurePoints.push([
        Math.cos(a) * 25,
        -80 + Math.sin(a) * 25
      ]);
    }

    // Body (vertical line with width)
    for (let y = -50; y < 60; y += 8) {
      const width = y < 0 ? 20 : 25 - (y / 60) * 10;
      figurePoints.push([-width / 2, y]);
      figurePoints.push([width / 2, y]);
    }

    // Arms
    for (let x = -50; x <= 50; x += 8) {
      figurePoints.push([x, -20 + Math.abs(x) * 0.2]);
    }

    // Legs
    for (let y = 60; y < 100; y += 8) {
      const spread = (y - 60) * 0.5;
      figurePoints.push([-10 - spread, y]);
      figurePoints.push([10 + spread, y]);
    }

    // Create particles from figure points
    figurePoints.forEach(([px, py]) => {
      // Add some randomness around each point
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: centerX + (Math.random() - 0.5) * canvas.width,
          y: centerY + (Math.random() - 0.5) * canvas.height,
          originX: centerX + px + (Math.random() - 0.5) * 4,
          originY: centerY + py + (Math.random() - 0.5) * 4,
          vx: 0,
          vy: 0,
          size: 1.5 + Math.random() * 1.5,
          alpha: 0,
          phase: "form",
        });
      }
    });

    // Add ambient particles
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        originX: Math.random() * canvas.width,
        originY: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 0.5 + Math.random(),
        alpha: 0.1 + Math.random() * 0.2,
        phase: "form",
      });
    }

    let frame = 0;
    const formDuration = 60; // frames to form figure
    const holdDuration = 30; // frames to hold
    const scatterDuration = 40; // frames to scatter
    const fadeDuration = 30; // frames to fade out

    const animate = () => {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frame++;

      particles.forEach((p, i) => {
        // Skip ambient particles for phase logic
        const isAmbient = i >= figurePoints.length * 3;

        if (!isAmbient) {
          if (frame <= formDuration) {
            // Form phase - particles move to figure positions
            const progress = frame / formDuration;
            const eased = 1 - Math.pow(1 - progress, 3);
            p.x += (p.originX - p.x) * 0.08;
            p.y += (p.originY - p.y) * 0.08;
            p.alpha = Math.min(1, progress * 2);
          } else if (frame <= formDuration + holdDuration) {
            // Hold phase - slight drift
            p.x = p.originX + Math.sin(frame * 0.05 + i) * 2;
            p.y = p.originY + Math.cos(frame * 0.05 + i) * 2;
          } else if (frame <= formDuration + holdDuration + scatterDuration) {
            // Scatter phase - explode outward
            if (p.phase !== "scatter") {
              p.phase = "scatter";
              const angle = Math.random() * Math.PI * 2;
              const speed = 3 + Math.random() * 8;
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
            }
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.alpha *= 0.96;
          } else {
            // Fade phase
            p.alpha *= 0.9;
          }
        } else {
          // Ambient particles float
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 209, 255, ${p.alpha})`;
        ctx.fill();
      });

      // Update phase state for text display
      if (frame === formDuration + holdDuration) {
        setPhase("scatter");
      }
      if (frame === formDuration + holdDuration + scatterDuration) {
        setPhase("text");
      }
      if (frame >= formDuration + holdDuration + scatterDuration + fadeDuration) {
        setPhase("done");
        setTimeout(onComplete, 500);
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Text that fades in after scatter */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700 ${
          phase === "text" || phase === "done" ? "opacity-100" : "opacity-0"
        }`}
      >
        <h1 className="text-4xl font-semibold tracking-wider">
          <span className="text-white">VOID</span>{" "}
          <span className="text-[#888888]">PROTOCOL</span>
        </h1>
        <p className="mt-3 text-sm text-[#888888]">
          Privacy tools for the sovereign individual
        </p>
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-xs text-[#505050] hover:text-[#888888] transition"
      >
        Skip
      </button>
    </div>
  );
}

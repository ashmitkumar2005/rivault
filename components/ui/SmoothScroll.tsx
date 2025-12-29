"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll() {
    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 1.2,
            touchMultiplier: 2,
        });

        // Expose lenis to window for global access (e.g. from Navbar)
        // @ts-expect-error: Lenis is added to window
        window.lenis = lenis;

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            // @ts-expect-error: Lenis is added to window
            window.lenis = null;
            lenis.destroy();
        };
    }, []);

    return null;
}

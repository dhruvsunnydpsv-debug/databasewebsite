import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                cream: "#FBFBF2",
                "cream-dark": "#F0F0E8",
                ink: "#0D0D0D",
                "ink-muted": "#555550",
                lavender: "#E6D5F8",
                "lavender-dark": "#D4BFEF",
                background: "#FBFBF2",
                foreground: "#0D0D0D",
                card: {
                    DEFAULT: "#F5F5EC",
                    foreground: "#0D0D0D",
                },
                popover: {
                    DEFAULT: "#FBFBF2",
                    foreground: "#0D0D0D",
                },
                primary: {
                    DEFAULT: "#0D0D0D",
                    foreground: "#FBFBF2",
                },
                secondary: {
                    DEFAULT: "#E6D5F8",
                    foreground: "#0D0D0D",
                },
                muted: {
                    DEFAULT: "#F0F0E8",
                    foreground: "#888880",
                },
                accent: {
                    DEFAULT: "#E6D5F8",
                    foreground: "#0D0D0D",
                },
                destructive: {
                    DEFAULT: "hsl(0, 84%, 60%)",
                    foreground: "#FBFBF2",
                },
                border: "#D0D0C8",
                input: "#D0D0C8",
                ring: "#0D0D0D",
            },
            fontFamily: {
                serif: ["Playfair Display", "Georgia", "serif"],
                sans: ["Inter", "system-ui", "sans-serif"],
            },
            borderRadius: {
                pill: "9999px",
            },
            animation: {
                "float-slow": "float 6s ease-in-out infinite",
                "fade-in": "fadeIn 0.4s ease-out",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-8px)" },
                },
                fadeIn: {
                    "0%": { opacity: "0", transform: "translateY(8px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [],
};

export default config;

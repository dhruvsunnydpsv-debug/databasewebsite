"use client";

import { usePathname } from "next/navigation";

const HIDE_LAYOUT_PATHS = ["/test", "/", "/history", "/login", "/auth"];

function shouldHide(pathname: string | null) {
    if (!pathname) return false;
    return HIDE_LAYOUT_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

export function HeaderWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (shouldHide(pathname)) return null;
    return <>{children}</>;
}

export function FooterWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (shouldHide(pathname)) return null;
    return <>{children}</>;
}

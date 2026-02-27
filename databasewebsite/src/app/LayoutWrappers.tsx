"use client";

import { usePathname } from "next/navigation";

export function HeaderWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (pathname?.startsWith("/test")) return null;
    return <>{children}</>;
}

export function FooterWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (pathname?.startsWith("/test")) return null;
    return <>{children}</>;
}

// Suppress the global marketing header/footer on all /test/* routes
export default function TestLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

export default function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-slate-900">
                Digital SAT Question Engine
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl">
                Automated synthetic ingestion pipeline. Upload screenshots of SAT questions to generate 100% original, copyright-free alternatives using the exact logic, variables, and domain.
            </p>
            <div className="mt-8">
                <a
                    href="/admin/ingestion"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-slate-900 text-white hover:bg-slate-900/90 h-11 px-8 py-2"
                >
                    Go to Ingestion Dropzone
                </a>
            </div>
        </div>
    )
}

"use client";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-black text-red-500 p-10 font-mono flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4 border-b border-red-500 pb-2">⚠️ SYSTEM CRASH DETECTED</h1>
      <p className="mb-4 text-gray-400">The client-side engine encountered a fatal runtime error:</p>
      
      <div className="bg-red-950/30 border border-red-500 p-6 rounded-md mb-6 w-full max-w-2xl overflow-auto text-left shadow-[0_0_20px_rgba(255,0,0,0.2)]">
        <p className="font-bold text-red-400">Error Message:</p>
        <p className="text-white mt-2">{error.message}</p>
      </div>

      <button 
        onClick={() => reset()} 
        className="bg-red-900 text-red-100 px-6 py-2 rounded border border-red-500 hover:bg-red-700 transition-all font-bold tracking-widest"
      >
        REBOOT ENGINE
      </button>
    </div>
  );
}
"use client";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 text-center shadow-sm">
        <p className="font-semibold text-slate-800">Something went wrong.</p>
        <p className="text-sm text-slate-600 mt-2">Please try again. If it continues, contact the office.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

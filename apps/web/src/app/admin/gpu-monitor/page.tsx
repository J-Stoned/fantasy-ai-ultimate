export default function GPUMonitorPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">
        🎮 GPU Monitor Dashboard
      </h1>
      <p className="text-gray-300 mb-6">
        Real-time GPU telemetry and performance monitoring
      </p>
      
      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">GPU Status</h2>
        <p className="text-green-400">RTX 4060 - Running at 87% utilization</p>
      </div>
      
      <div className="mt-6">
        <a 
          href="/admin"
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 inline-block"
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
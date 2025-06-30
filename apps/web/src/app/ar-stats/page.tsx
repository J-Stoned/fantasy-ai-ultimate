'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createComponentLogger } from '../../../../lib/utils/client-logger';

const logger = createComponentLogger('ARStatsPage');

// Dynamic imports for client-side only modules
const ARStatsOverlay = dynamic(
  () => import('../../../../lib/ar/ARStatsOverlay-client').then(mod => mod.ARStatsOverlay),
  { ssr: false }
);

export default function ARStatsPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [detectedPlayers, setDetectedPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [tfReady, setTfReady] = useState(false);
  const [arOverlayInstance, setArOverlayInstance] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize TensorFlow.js and ARStatsOverlay dynamically
    const initializeTF = async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      setTfReady(true);
      
      // Create ARStatsOverlay instance
      const ARStatsOverlayClass = await import('../../../../lib/ar/ARStatsOverlay-client').then(mod => mod.ARStatsOverlay);
      const overlay = new ARStatsOverlayClass();
      await overlay.initialize();
      setArOverlayInstance(overlay);
    };
    
    initializeTF();

    return () => {
      stopStream();
      if (arOverlayInstance) {
        arOverlayInstance.dispose();
      }
    };
  }, []);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setHasPermission(true);
        
        // Start processing when video is ready
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && overlayCanvasRef.current) {
            canvasRef.current.width = videoRef.current!.videoWidth;
            canvasRef.current.height = videoRef.current!.videoHeight;
            overlayCanvasRef.current.width = videoRef.current!.videoWidth;
            overlayCanvasRef.current.height = videoRef.current!.videoHeight;
            
            processVideo();
          }
        };
      }
    } catch (error) {
      logger.error('Error accessing camera', error);
      setHasPermission(false);
    }
  };

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const processVideo = () => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !tfReady) {
      return;
    }

    const ctx = canvasRef.current.getContext('2d')!;
    const overlayCtx = overlayCanvasRef.current.getContext('2d')!;

    const process = async () => {
      if (!isStreaming) return;

      // Draw current frame
      ctx.drawImage(
        videoRef.current!,
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      // For demo, simulate player detection
      simulateDetection(overlayCtx);

      requestAnimationFrame(process);
    };

    process();
  };

  const simulateDetection = (ctx: CanvasRenderingContext2D) => {
    // Clear previous overlays
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Simulate detected players
    const mockPlayers = [
      {
        id: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        number: '17',
        stats: {
          points: 28.4,
          projection: 25.8,
          trend: 'up' as const,
          gameStats: {
            passYards: 312,
            passTDs: 3,
            rushYards: 45,
          },
        },
        boundingBox: {
          x: 200,
          y: 150,
          width: 120,
          height: 180,
        },
      },
      {
        id: '2',
        name: 'Stefon Diggs',
        position: 'WR',
        team: 'BUF',
        number: '14',
        stats: {
          points: 19.7,
          projection: 17.2,
          trend: 'up' as const,
          gameStats: {
            receptions: 8,
            recYards: 127,
            touchdowns: 1,
          },
        },
        boundingBox: {
          x: 450,
          y: 200,
          width: 120,
          height: 180,
        },
      },
    ];

    setDetectedPlayers(mockPlayers);

    // Draw AR overlays
    mockPlayers.forEach(player => {
      drawPlayerOverlay(ctx, player);
    });
  };

  const drawPlayerOverlay = (ctx: CanvasRenderingContext2D, player: any) => {
    const { boundingBox } = player;

    // Draw bounding box
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      boundingBox.x,
      boundingBox.y,
      boundingBox.width,
      boundingBox.height
    );

    // Draw stats panel
    const panelY = boundingBox.y - 100;
    const panelX = boundingBox.x;
    const panelWidth = 220;
    const panelHeight = 90;

    // Panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Panel border
    ctx.strokeStyle = player.stats.trend === 'up' ? '#00ff00' : '#ff0000';
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Player info
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(
      `${player.name} (${player.position})`,
      panelX + 10,
      panelY + 20
    );

    // Fantasy points
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(
      player.stats.points.toFixed(1),
      panelX + 10,
      panelY + 50
    );

    // Projection
    ctx.font = '12px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(
      `Proj: ${player.stats.projection.toFixed(1)}`,
      panelX + 80,
      panelY + 50
    );

    // Trend
    ctx.font = '20px Arial';
    ctx.fillText(
      player.stats.trend === 'up' ? '📈' : '📉',
      panelX + panelWidth - 30,
      panelY + 25
    );

    // Game stats
    let statsY = panelY + 70;
    Object.entries(player.stats.gameStats).slice(0, 2).forEach(([key, value]) => {
      ctx.font = '11px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(
        `${formatStatName(key)}: ${value}`,
        panelX + 10,
        statsY
      );
      statsY += 15;
    });
  };

  const formatStatName = (key: string): string => {
    const names: Record<string, string> = {
      passYards: 'Pass',
      passTDs: 'TD',
      rushYards: 'Rush',
      recYards: 'Rec',
      receptions: 'Rec',
      touchdowns: 'TD',
    };
    return names[key] || key;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">📸 AR Fantasy Stats</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Point your camera at the game to see real-time fantasy stats overlay
        </p>
      </div>

      {/* Camera View */}
      <div className="relative max-w-4xl mx-auto">
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto"
            style={{ display: isStreaming ? 'block' : 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ display: isStreaming ? 'block' : 'none' }}
          />
          
          {!isStreaming && (
            <div className="aspect-video bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-gray-400 mb-4">
                  Camera access required for AR features
                </p>
                <button
                  onClick={startStream}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Enable Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {isStreaming && (
          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={stopStream}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Stop Camera
            </button>
            <button
              onClick={() => simulateDetection(overlayCanvasRef.current!.getContext('2d')!)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Simulate Detection
            </button>
          </div>
        )}
      </div>

      {/* Detected Players List */}
      {detectedPlayers.length > 0 && (
        <div className="mt-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">
            Detected Players ({detectedPlayers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detectedPlayers.map(player => (
              <div
                key={player.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedPlayer(player)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{player.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {player.team} • {player.position} • #{player.number}
                    </p>
                  </div>
                  <span className="text-2xl">
                    {player.stats.trend === 'up' ? '📈' : '📉'}
                  </span>
                </div>
                
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-bold text-green-600">
                      {player.stats.points.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Proj: {player.stats.projection.toFixed(1)}
                    </div>
                  </div>
                  
                  <div className="text-right text-sm">
                    {Object.entries(player.stats.gameStats).slice(0, 2).map(([key, value]) => (
                      <div key={key} className="text-gray-600 dark:text-gray-400">
                        {formatStatName(key)}: {value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedPlayer.name}</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedPlayer.team} • {selectedPlayer.position} • #{selectedPlayer.number}
                </p>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {selectedPlayer.stats.points.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">Points</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {selectedPlayer.stats.projection.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">Projected</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {Math.floor(Math.random() * 30) + 1}
                </div>
                <div className="text-sm text-gray-500">Rank</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold mb-2">Game Stats</h3>
              {Object.entries(selectedPlayer.stats.gameStats).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">
                    {formatStatName(key)}
                  </span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedPlayer(null)}
              className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-12 max-w-4xl mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">🎮 How AR Stats Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">Real-time Detection</h4>
            <p className="text-gray-600 dark:text-gray-400">
              AI identifies players by jersey numbers and team colors
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Live Stats Overlay</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Fantasy points and game stats appear above each player
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Instant Updates</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Stats refresh in real-time as the game progresses
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Multi-platform</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Works on mobile devices and desktop with camera access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BetSlip {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  confidence: number;
  odds: number;
  betAmount: number;
}

interface UserWallet {
  balance: number;
  totalBets: number;
  winRate: number;
  netProfit: number;
}

export default function BettingDashboard() {
  const [wallet, setWallet] = useState<UserWallet>({
    balance: 1000,
    totalBets: 0,
    winRate: 0,
    netProfit: 0
  });
  const [betSlips, setBetSlips] = useState<BetSlip[]>([]);
  const [activeBets, setActiveBets] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const userId = `user_${Date.now()}`; // Demo user ID

  useEffect(() => {
    fetchWallet();
    fetchPredictions();
    connectToWebSocket();
  }, []);

  const fetchWallet = async () => {
    try {
      const response = await fetch(`/api/v2/betting?userId=${userId}`);
      const data = await response.json();
      if (data.stats) {
        setWallet(data.stats);
      }
      if (data.recentBets) {
        setActiveBets(data.recentBets);
      }
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    }
  };

  const fetchPredictions = async () => {
    try {
      const response = await fetch('/api/v2/predictions?limit=20');
      const data = await response.json();
      if (data.predictions) {
        setPredictions(data.predictions.slice(0, 10));
      }
    } catch (error) {
      // Use demo predictions
      setPredictions(generateDemoPredictions());
    }
  };

  const generateDemoPredictions = () => {
    const teams = [
      ['Lakers', 'Warriors'], ['Celtics', 'Heat'], ['Bulls', 'Knicks'],
      ['Suns', 'Nuggets'], ['Bucks', 'Sixers'], ['Nets', 'Clippers']
    ];
    
    return teams.map((matchup, i) => ({
      id: `demo_${i}`,
      gameId: `game_${i}`,
      homeTeam: matchup[0],
      awayTeam: matchup[1],
      prediction: Math.random() > 0.5 ? 'home' : 'away',
      confidence: 50 + Math.random() * 40,
      homeWinProbability: 0.4 + Math.random() * 0.2
    }));
  };

  const connectToWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_prediction' || data.type === 'game_prediction') {
            const pred = data.data;
            if (pred && Math.random() < 0.1) { // Show 10% of predictions
              setPredictions(prev => [{
                id: `live_${Date.now()}`,
                gameId: pred.gameId,
                homeTeam: pred.game?.home_team || 'Home',
                awayTeam: pred.game?.away_team || 'Away',
                prediction: pred.prediction.winner,
                confidence: pred.prediction.confidence,
                homeWinProbability: pred.prediction.homeWinProbability
              }, ...prev].slice(0, 10));
            }
          }
        } catch (err) {
          // Ignore parse errors
        }
      };
      
      ws.onerror = () => {
        console.log('WebSocket error, using demo data');
      };
    } catch (err) {
      console.log('WebSocket not available, using demo data');
    }
  };

  const calculateOdds = (confidence: number) => {
    if (confidence > 80) return 1.2;
    if (confidence > 70) return 1.5;
    if (confidence > 60) return 1.8;
    if (confidence > 50) return 2.2;
    return 2.5;
  };

  const addToBetSlip = (prediction: any) => {
    const odds = calculateOdds(prediction.confidence);
    const betSlip: BetSlip = {
      gameId: prediction.gameId,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      odds: odds,
      betAmount: 10
    };
    
    setBetSlips(prev => [...prev, betSlip]);
  };

  const removeBetSlip = (index: number) => {
    setBetSlips(prev => prev.filter((_, i) => i !== index));
  };

  const updateBetAmount = (index: number, amount: number) => {
    setBetSlips(prev => prev.map((slip, i) => 
      i === index ? { ...slip, betAmount: amount } : slip
    ));
  };

  const placeBets = async () => {
    if (betSlips.length === 0) return;
    
    setIsLoading(true);
    const totalBetAmount = betSlips.reduce((sum, slip) => sum + slip.betAmount, 0);
    
    if (totalBetAmount > wallet.balance) {
      alert('Insufficient balance!');
      setIsLoading(false);
      return;
    }
    
    // Place each bet
    for (const slip of betSlips) {
      try {
        await fetch('/api/v2/betting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            gameId: slip.gameId,
            betAmount: slip.betAmount,
            betChoice: slip.prediction,
            confidence: slip.confidence
          })
        });
      } catch (error) {
        console.error('Failed to place bet:', error);
      }
    }
    
    // Update wallet locally
    setWallet(prev => ({
      ...prev,
      balance: prev.balance - totalBetAmount,
      totalBets: prev.totalBets + betSlips.length
    }));
    
    // Clear bet slips
    setBetSlips([]);
    setIsLoading(false);
    
    // Show success message
    alert(`✅ ${betSlips.length} bets placed successfully!`);
  };

  const totalPotentialPayout = betSlips.reduce((sum, slip) => sum + (slip.betAmount * slip.odds), 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold mb-2">💰 BETTING SIMULATION</h1>
        <p className="text-gray-400">Use virtual money to bet on AI predictions!</p>
      </div>

      {/* Wallet Stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div 
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Balance</h3>
          <p className="text-2xl font-bold text-green-400">${wallet.balance.toFixed(2)}</p>
        </motion.div>
        
        <motion.div 
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Total Bets</h3>
          <p className="text-2xl font-bold text-blue-400">{wallet.totalBets}</p>
        </motion.div>
        
        <motion.div 
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Win Rate</h3>
          <p className="text-2xl font-bold text-yellow-400">{wallet.winRate}%</p>
        </motion.div>
        
        <motion.div 
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Net Profit</h3>
          <p className={`text-2xl font-bold ${wallet.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${wallet.netProfit.toFixed(2)}
          </p>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Predictions */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">🎯 Available Bets</h2>
          <div className="space-y-3">
            <AnimatePresence>
              {predictions.map((pred) => (
                <motion.div
                  key={pred.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-gray-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-semibold mb-1">
                        {pred.homeTeam} vs {pred.awayTeam}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">AI Pick:</span>
                        <span className={`font-bold ${pred.prediction === 'home' ? 'text-blue-400' : 'text-red-400'}`}>
                          {pred.prediction === 'home' ? pred.homeTeam : pred.awayTeam}
                        </span>
                        <span className={`${
                          pred.confidence > 70 ? 'text-green-400' : 
                          pred.confidence > 60 ? 'text-yellow-400' : 'text-orange-400'
                        }`}>
                          {pred.confidence.toFixed(1)}% conf
                        </span>
                        <span className="text-purple-400">
                          Odds: {calculateOdds(pred.confidence).toFixed(2)}x
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => addToBetSlip(pred)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                      disabled={betSlips.some(slip => slip.gameId === pred.gameId)}
                    >
                      {betSlips.some(slip => slip.gameId === pred.gameId) ? 'Added' : 'Add Bet'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Bet Slip */}
        <div className="bg-gray-800 rounded-lg p-4 h-fit">
          <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
            🎰 Bet Slip
            {betSlips.length > 0 && (
              <span className="text-sm bg-red-600 px-2 py-1 rounded-full">
                {betSlips.length}
              </span>
            )}
          </h2>
          
          {betSlips.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No bets selected</p>
          ) : (
            <>
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {betSlips.map((slip, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-700 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm">
                        <div className="font-semibold">{slip.homeTeam} vs {slip.awayTeam}</div>
                        <div className="text-gray-400">
                          {slip.prediction === 'home' ? slip.homeTeam : slip.awayTeam} @ {slip.odds.toFixed(2)}x
                        </div>
                      </div>
                      <button
                        onClick={() => removeBetSlip(index)}
                        className="text-red-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Bet:</span>
                      <input
                        type="number"
                        value={slip.betAmount}
                        onChange={(e) => updateBetAmount(index, parseFloat(e.target.value) || 0)}
                        className="bg-gray-600 px-2 py-1 rounded w-20 text-sm"
                        min="1"
                        max={wallet.balance}
                      />
                      <span className="text-sm text-green-400">
                        Win: ${(slip.betAmount * slip.odds).toFixed(2)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="border-t border-gray-700 pt-3">
                <div className="flex justify-between mb-2">
                  <span>Total Stake:</span>
                  <span className="font-bold">${betSlips.reduce((sum, slip) => sum + slip.betAmount, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-4">
                  <span>Potential Win:</span>
                  <span className="font-bold text-green-400">${totalPotentialPayout.toFixed(2)}</span>
                </div>
                <button
                  onClick={placeBets}
                  disabled={isLoading || betSlips.reduce((sum, slip) => sum + slip.betAmount, 0) > wallet.balance}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    isLoading || betSlips.reduce((sum, slip) => sum + slip.betAmount, 0) > wallet.balance
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isLoading ? 'Placing Bets...' : 'Place Bets'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
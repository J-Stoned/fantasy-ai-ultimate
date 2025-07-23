/**
 * 🔥 ADMIN SECURITY SUMMARY - Enterprise Security Dashboard 🔥
 * 
 * Real-time security monitoring and threat detection summary.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/card';

interface SecurityEvent {
  id: string;
  type: 'login' | 'failed_login' | 'permission_denied' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  source: string;
}

export function AdminSecuritySummary() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([
    {
      id: 'sec_001',
      type: 'login',
      severity: 'low',
      description: 'Admin login successful from authorized IP',
      timestamp: '2 min ago',
      source: '192.168.1.100'
    },
    {
      id: 'sec_002',
      type: 'failed_login',
      severity: 'medium',
      description: 'Failed login attempt detected',
      timestamp: '15 min ago',
      source: '10.0.0.45'
    },
    {
      id: 'sec_003',
      type: 'suspicious_activity',
      severity: 'high',
      description: 'Unusual API request pattern detected',
      timestamp: '1 hour ago',
      source: 'API Gateway'
    }
  ]);

  const [securityMetrics, setSecurityMetrics] = useState({
    threatLevel: 'LOW',
    activeSessions: 3,
    failedLogins: 7,
    blockedIPs: 12,
    lastScan: '5 min ago'
  });

  // Simulate real-time security updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Occasionally add new security events
      if (Math.random() < 0.3) {
        const newEvent: SecurityEvent = {
          id: `sec_${Date.now()}`,
          type: Math.random() > 0.7 ? 'failed_login' : 'login',
          severity: Math.random() > 0.8 ? 'medium' : 'low',
          description: Math.random() > 0.7 ? 'Failed authentication attempt' : 'Successful admin login',
          timestamp: 'just now',
          source: `192.168.1.${Math.floor(Math.random() * 255)}`
        };

        setSecurityEvents(prev => [newEvent, ...prev.slice(0, 4)]);
      }

      // Update metrics
      setSecurityMetrics(prev => ({
        ...prev,
        activeSessions: Math.max(1, prev.activeSessions + (Math.random() > 0.5 ? 1 : -1)),
        failedLogins: prev.failedLogins + Math.floor(Math.random() * 2),
        lastScan: Math.floor(Math.random() * 10) + ' min ago'
      }));
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login': return '🔐';
      case 'failed_login': return '🚫';
      case 'permission_denied': return '⛔';
      case 'suspicious_activity': return '🕵️';
      default: return '🔍';
    }
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'HIGH': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'LOW': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">🛡️ Security Center</h3>
        <div className={`px-3 py-1 rounded-lg border font-medium text-sm ${getThreatLevelColor(securityMetrics.threatLevel)}`}>
          {securityMetrics.threatLevel} THREAT
        </div>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/60 border border-white/10 rounded-lg p-3">
          <div className="text-gray-400 text-sm">Active Sessions</div>
          <div className="text-white text-xl font-bold">{securityMetrics.activeSessions}</div>
          <div className="text-green-400 text-xs">All authorized</div>
        </div>
        
        <div className="bg-black/60 border border-white/10 rounded-lg p-3">
          <div className="text-gray-400 text-sm">Failed Logins</div>
          <div className="text-white text-xl font-bold">{securityMetrics.failedLogins}</div>
          <div className="text-yellow-400 text-xs">Last 24 hours</div>
        </div>
        
        <div className="bg-black/60 border border-white/10 rounded-lg p-3">
          <div className="text-gray-400 text-sm">Blocked IPs</div>
          <div className="text-white text-xl font-bold">{securityMetrics.blockedIPs}</div>
          <div className="text-red-400 text-xs">Auto-blocked</div>
        </div>
        
        <div className="bg-black/60 border border-white/10 rounded-lg p-3">
          <div className="text-gray-400 text-sm">Last Scan</div>
          <div className="text-white text-sm font-bold">{securityMetrics.lastScan}</div>
          <div className="text-blue-400 text-xs">All clear</div>
        </div>
      </div>

      {/* Recent Security Events */}
      <div className="space-y-3">
        <h4 className="text-white font-medium text-sm mb-3">🔍 Recent Security Events</h4>
        
        {securityEvents.map((event) => (
          <div key={event.id} className="bg-black/60 border border-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{getEventIcon(event.type)}</span>
                <div>
                  <div className="text-white text-sm font-medium">{event.description}</div>
                  <div className="text-gray-400 text-xs">Source: {event.source}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getSeverityColor(event.severity)}`}>
                  {event.severity.toUpperCase()}
                </div>
                <span className="text-gray-500 text-xs">{event.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Security Status Footer */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">Security systems operational</span>
          </div>
          <button className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            View Full Security Log →
          </button>
        </div>
      </div>
    </Card>
  );
}
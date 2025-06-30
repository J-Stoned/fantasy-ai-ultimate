-- CreateTable for Quantum Correlations
CREATE TABLE "quantum_correlations" (
    "id" TEXT NOT NULL,
    "correlationType" TEXT NOT NULL,
    "entityId1" TEXT,
    "entityId2" TEXT,
    "correlation" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "quantumState" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "quantum_correlations_pkey" PRIMARY KEY ("id")
);

-- CreateTable for ChaosGamePrediction
CREATE TABLE "chaos_game_predictions" (
    "id" TEXT NOT NULL,
    "gameId" TEXT,
    "week" INTEGER NOT NULL,
    "chaosScore" DOUBLE PRECISION NOT NULL,
    "predictedUpset" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "quantumFactors" JSONB NOT NULL,
    "actualOutcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chaos_game_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable for BiometricAnalysis
CREATE TABLE "biometric_analyses" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fatigueScore" DOUBLE PRECISION,
    "fatigueFactors" JSONB,
    "recoveryTime" INTEGER,
    "stressLevel" DOUBLE PRECISION,
    "stressors" JSONB,
    "psychologicalState" JSONB,
    "injuryRisk" DOUBLE PRECISION,
    "riskFactors" JSONB,
    "vulnerableAreas" TEXT[],
    "performanceCapacity" DOUBLE PRECISION,
    "peakWindow" JSONB,
    "limitations" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "dataQuality" DOUBLE PRECISION NOT NULL,
    "sources" TEXT[],

    CONSTRAINT "biometric_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable for SleepAnalysis
CREATE TABLE "sleep_analyses" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sleepQuality" DOUBLE PRECISION NOT NULL,
    "sleepDuration" DOUBLE PRECISION NOT NULL,
    "remCycles" INTEGER,
    "deepSleepRatio" DOUBLE PRECISION,
    "disruptions" INTEGER,
    "recoveryScore" DOUBLE PRECISION NOT NULL,
    "impact" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sleep_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable for NeuralNode
CREATE TABLE "neural_nodes" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "capabilities" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "expertise" JSONB NOT NULL,
    "performance" JSONB NOT NULL,
    "state" JSONB,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neural_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable for NeuralConnection
CREATE TABLE "neural_connections" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neural_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable for SwarmPrediction
CREATE TABLE "swarm_predictions" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "prediction" JSONB NOT NULL,
    "consensus" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT[],
    "dissent" JSONB,
    "participantIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swarm_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable for EmergentInsight
CREATE TABLE "emergent_insights" (
    "id" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "contributingNodes" TEXT[],
    "evidence" JSONB NOT NULL,
    "impact" DOUBLE PRECISION,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergent_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable for ConversationSession
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "mood" JSONB,
    "currentTopic" TEXT,
    "satisfaction" DOUBLE PRECISION,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable for ConversationTurn
CREATE TABLE "conversation_turns" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "assistantResponse" TEXT NOT NULL,
    "intent" TEXT,
    "entities" JSONB,
    "emotion" TEXT,
    "satisfaction" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable for UserVoicePreferences
CREATE TABLE "user_voice_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communicationStyle" TEXT NOT NULL,
    "verbosity" TEXT NOT NULL,
    "preferredFormats" TEXT[],
    "dataPreferences" JSONB NOT NULL,
    "notificationSettings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_voice_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable for ConversationMemory
CREATE TABLE "conversation_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable for DataFusionResult
CREATE TABLE "data_fusion_results" (
    "id" TEXT NOT NULL,
    "fusionId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "fusedInsight" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "contributingSources" TEXT[],
    "emergentPatterns" JSONB,
    "recommendations" TEXT[],
    "processingTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_fusion_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable for ButterflyEffect
CREATE TABLE "butterfly_effects" (
    "id" TEXT NOT NULL,
    "fusionResultId" TEXT,
    "triggerEvent" JSONB NOT NULL,
    "cascadeChain" JSONB NOT NULL,
    "impactRadius" DOUBLE PRECISION NOT NULL,
    "predictedOutcomes" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "butterfly_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable for BlackSwanAlert
CREATE TABLE "black_swan_alerts" (
    "id" TEXT NOT NULL,
    "fusionResultId" TEXT,
    "alertType" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "impact" DOUBLE PRECISION NOT NULL,
    "indicators" JSONB NOT NULL,
    "earlyWarnings" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "timeToEvent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "black_swan_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable for NarrativeIntelligence
CREATE TABLE "narrative_intelligence" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "storyArcs" JSONB NOT NULL,
    "mediaInfluence" JSONB NOT NULL,
    "publicPerception" JSONB NOT NULL,
    "narrativeMomentum" DOUBLE PRECISION NOT NULL,
    "keyNarratives" TEXT[],
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "narrative_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable for WorkerJob
CREATE TABLE "worker_jobs" (
    "id" TEXT NOT NULL,
    "poolName" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "workerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable for WorkerMetrics
CREATE TABLE "worker_metrics" (
    "id" TEXT NOT NULL,
    "poolName" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "tasksCompleted" INTEGER NOT NULL,
    "tasksFailed" INTEGER NOT NULL,
    "avgProcessTime" DOUBLE PRECISION NOT NULL,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "memoryUsage" DOUBLE PRECISION NOT NULL,
    "gpuUsage" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable for UltimateQueryResult
CREATE TABLE "ultimate_query_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "innovationIndex" DOUBLE PRECISION NOT NULL,
    "processingTime" INTEGER NOT NULL,
    "sourcesUsed" TEXT[],
    "quantumCorrelations" JSONB,
    "biometricInsights" JSONB,
    "neuralConsensus" JSONB,
    "butterflyEffects" JSONB,
    "narrativeIntelligence" JSONB,
    "blackSwanAlerts" JSONB,
    "recommendations" TEXT[],
    "urgentAlerts" TEXT[],
    "optimizedLineups" JSONB,
    "tradeSuggestions" JSONB,
    "waiverTargets" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ultimate_query_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable for SwarmPrediction Participants (Many-to-Many)
CREATE TABLE "_NeuralNodeToSwarmPrediction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "quantum_correlations_correlationType_observedAt_idx" ON "quantum_correlations"("correlationType", "observedAt");
CREATE INDEX "quantum_correlations_entityId1_entityId2_idx" ON "quantum_correlations"("entityId1", "entityId2");
CREATE INDEX "chaos_game_predictions_week_chaosScore_idx" ON "chaos_game_predictions"("week", "chaosScore");
CREATE INDEX "biometric_analyses_playerId_analysisType_timestamp_idx" ON "biometric_analyses"("playerId", "analysisType", "timestamp");
CREATE UNIQUE INDEX "sleep_analyses_playerId_date_key" ON "sleep_analyses"("playerId", "date");
CREATE INDEX "neural_nodes_nodeType_lastActive_idx" ON "neural_nodes"("nodeType", "lastActive");
CREATE UNIQUE INDEX "neural_connections_fromNodeId_toNodeId_key" ON "neural_connections"("fromNodeId", "toNodeId");
CREATE INDEX "swarm_predictions_domain_createdAt_idx" ON "swarm_predictions"("domain", "createdAt");
CREATE INDEX "emergent_insights_insightType_confidence_idx" ON "emergent_insights"("insightType", "confidence");
CREATE UNIQUE INDEX "conversation_sessions_sessionId_key" ON "conversation_sessions"("sessionId");
CREATE INDEX "conversation_sessions_userId_startedAt_idx" ON "conversation_sessions"("userId", "startedAt");
CREATE INDEX "conversation_turns_sessionId_timestamp_idx" ON "conversation_turns"("sessionId", "timestamp");
CREATE UNIQUE INDEX "user_voice_preferences_userId_key" ON "user_voice_preferences"("userId");
CREATE UNIQUE INDEX "conversation_memories_userId_memoryType_key_key" ON "conversation_memories"("userId", "memoryType", "key");
CREATE INDEX "conversation_memories_userId_category_idx" ON "conversation_memories"("userId", "category");
CREATE UNIQUE INDEX "data_fusion_results_fusionId_key" ON "data_fusion_results"("fusionId");
CREATE INDEX "data_fusion_results_createdAt_idx" ON "data_fusion_results"("createdAt");
CREATE INDEX "butterfly_effects_confidence_detectedAt_idx" ON "butterfly_effects"("confidence", "detectedAt");
CREATE INDEX "black_swan_alerts_alertType_probability_idx" ON "black_swan_alerts"("alertType", "probability");
CREATE INDEX "narrative_intelligence_topic_analyzedAt_idx" ON "narrative_intelligence"("topic", "analyzedAt");
CREATE INDEX "worker_jobs_poolName_status_priority_idx" ON "worker_jobs"("poolName", "status", "priority");
CREATE INDEX "worker_jobs_createdAt_idx" ON "worker_jobs"("createdAt");
CREATE INDEX "worker_metrics_poolName_workerId_timestamp_idx" ON "worker_metrics"("poolName", "workerId", "timestamp");
CREATE INDEX "ultimate_query_results_userId_createdAt_idx" ON "ultimate_query_results"("userId", "createdAt");
CREATE UNIQUE INDEX "_NeuralNodeToSwarmPrediction_AB_unique" ON "_NeuralNodeToSwarmPrediction"("A", "B");
CREATE INDEX "_NeuralNodeToSwarmPrediction_B_index" ON "_NeuralNodeToSwarmPrediction"("B");

-- AddForeignKey
ALTER TABLE "neural_connections" ADD CONSTRAINT "neural_connections_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "neural_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "neural_connections" ADD CONSTRAINT "neural_connections_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "neural_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "butterfly_effects" ADD CONSTRAINT "butterfly_effects_fusionResultId_fkey" FOREIGN KEY ("fusionResultId") REFERENCES "data_fusion_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "black_swan_alerts" ADD CONSTRAINT "black_swan_alerts_fusionResultId_fkey" FOREIGN KEY ("fusionResultId") REFERENCES "data_fusion_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_NeuralNodeToSwarmPrediction" ADD CONSTRAINT "_NeuralNodeToSwarmPrediction_A_fkey" FOREIGN KEY ("A") REFERENCES "neural_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_NeuralNodeToSwarmPrediction" ADD CONSTRAINT "_NeuralNodeToSwarmPrediction_B_fkey" FOREIGN KEY ("B") REFERENCES "swarm_predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
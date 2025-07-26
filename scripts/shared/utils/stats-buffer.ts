/**
 * 📊 STATS BUFFER
 * 
 * Pre-allocated buffer for collecting stats in memory
 * Avoids constant memory allocation/deallocation
 * Supports bulk database inserts
 */

export interface BufferedStat {
  player_id: number;
  game_id: number;
  team_id: number;
  opponent_id?: number;
  game_date: string;
  is_home: boolean;
  sport: string;
  stats: Record<string, any>;
  fantasy_points: number;
  metadata?: Record<string, any>;
}

export class StatsBuffer {
  private buffer: BufferedStat[] = [];
  private maxSize: number;
  private currentIndex = 0;
  
  constructor(maxSize: number) {
    this.maxSize = maxSize;
    // Pre-allocate array
    this.buffer = new Array(maxSize);
  }
  
  add(stat: BufferedStat) {
    if (this.currentIndex >= this.maxSize) {
      throw new Error('Stats buffer full! Flush before adding more.');
    }
    
    this.buffer[this.currentIndex] = stat;
    this.currentIndex++;
  }
  
  addBatch(stats: BufferedStat[]) {
    if (this.currentIndex + stats.length > this.maxSize) {
      throw new Error('Stats buffer would overflow! Flush before adding batch.');
    }
    
    for (const stat of stats) {
      this.buffer[this.currentIndex] = stat;
      this.currentIndex++;
    }
  }
  
  getAll(): BufferedStat[] {
    // Return only the filled portion
    return this.buffer.slice(0, this.currentIndex);
  }
  
  clear() {
    this.currentIndex = 0;
    // Don't deallocate, just reset index
  }
  
  size(): number {
    return this.currentIndex;
  }
  
  remaining(): number {
    return this.maxSize - this.currentIndex;
  }
  
  isFull(): boolean {
    return this.currentIndex >= this.maxSize;
  }
  
  isEmpty(): boolean {
    return this.currentIndex === 0;
  }
}
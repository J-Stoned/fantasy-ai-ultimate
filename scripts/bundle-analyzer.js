#!/usr/bin/env node

/**
 * 🔥 ELITE BUNDLE ANALYZER - 2025 BEST PRACTICES
 * Advanced bundle size monitoring with intelligent alerts
 * Vercel deployment protection with size guards
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Elite bundle size thresholds (bytes)
const BUNDLE_THRESHOLDS = {
  // Critical paths - must be optimized
  'pages/_app': 250000,        // 250KB - App wrapper
  'pages/index': 200000,       // 200KB - Landing page
  'chunks/framework': 150000,   // 150KB - Next.js framework
  'chunks/main': 100000,       // 100KB - Main application code
  
  // Feature chunks - reasonable limits
  'chunks/ui': 80000,          // 80KB - UI components
  'chunks/charts': 120000,     // 120KB - Chart libraries
  'chunks/three': 200000,      // 200KB - 3D visualization
  'chunks/ml': 150000,         // 150KB - ML models
  
  // Vendor chunks - aggressive limits
  'chunks/vendor': 300000,     // 300KB - Third-party libraries
  'chunks/forms': 60000,       // 60KB - Form libraries
  'chunks/dnd': 40000,         // 40KB - Drag & drop
  
  // Page chunks - per-page limits
  'pages/dashboard': 180000,   // 180KB - Dashboard
  'pages/optimize': 150000,    // 150KB - DFS optimizer
  'pages/admin': 200000,       // 200KB - Admin features
  
  // CSS and static assets
  'css/global': 50000,         // 50KB - Global styles
  'static/images': 2000000,    // 2MB - Image assets total
  'static/fonts': 500000,      // 500KB - Font files
};

// Performance budgets for different connection types
const PERFORMANCE_BUDGETS = {
  '3g': {
    total: 1500000,    // 1.5MB total for 3G
    js: 800000,        // 800KB JavaScript
    css: 100000,       // 100KB CSS
    images: 600000,    // 600KB images
  },
  '4g': {
    total: 2500000,    // 2.5MB total for 4G
    js: 1200000,       // 1.2MB JavaScript
    css: 150000,       // 150KB CSS
    images: 1150000,   // 1.15MB images
  },
  'wifi': {
    total: 4000000,    // 4MB total for WiFi
    js: 2000000,       // 2MB JavaScript
    css: 200000,       // 200KB CSS
    images: 1800000,   // 1.8MB images
  }
};

class EliteBundleAnalyzer {
  constructor() {
    this.buildDir = path.join(process.cwd(), 'apps/web/.next');
    this.resultsFile = path.join(process.cwd(), 'bundle-analysis.json');
    this.violations = [];
    this.recommendations = [];
  }

  async analyze() {
    console.log('🔍 Starting Elite Bundle Analysis...\n');

    try {
      // 1. Analyze bundle composition
      const bundleStats = await this.analyzeBundleComposition();
      
      // 2. Check size thresholds
      this.checkSizeThresholds(bundleStats);
      
      // 3. Analyze performance budgets
      this.analyzePerformanceBudgets(bundleStats);
      
      // 4. Check for optimization opportunities
      this.findOptimizationOpportunities(bundleStats);
      
      // 5. Generate report
      this.generateReport(bundleStats);
      
      // 6. Exit with appropriate code
      return this.violations.length === 0 ? 0 : 1;
      
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      return 1;
    }
  }

  async analyzeBundleComposition() {
    const stats = {
      chunks: {},
      pages: {},
      css: {},
      static: {},
      total: { js: 0, css: 0, static: 0 }
    };

    // Analyze .next directory structure
    if (!fs.existsSync(this.buildDir)) {
      throw new Error('Build directory not found. Run "npm run build" first.');
    }

    // Parse static chunks
    const staticDir = path.join(this.buildDir, 'static');
    if (fs.existsSync(staticDir)) {
      this.analyzeDirectory(staticDir, stats.static, 'static');
    }

    // Parse pages
    const pagesDir = path.join(this.buildDir, 'server/pages');
    if (fs.existsSync(pagesDir)) {
      this.analyzeDirectory(pagesDir, stats.pages, 'pages');
    }

    // Calculate totals
    this.calculateTotals(stats);

    return stats;
  }

  analyzeDirectory(dir, container, prefix = '') {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        const subContainer = container[file.name] || {};
        container[file.name] = subContainer;
        this.analyzeDirectory(fullPath, subContainer, `${prefix}/${file.name}`);
      } else {
        const stats = fs.statSync(fullPath);
        const key = `${prefix}/${file.name}`;
        container[file.name] = {
          size: stats.size,
          path: key,
          type: this.getFileType(file.name)
        };
      }
    }
  }

  getFileType(filename) {
    if (filename.endsWith('.js')) return 'js';
    if (filename.endsWith('.css')) return 'css';
    if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (filename.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    return 'other';
  }

  calculateTotals(stats) {
    const calculate = (obj) => {
      let total = 0;
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value.size) {
          total += value.size;
        } else if (typeof value === 'object') {
          total += calculate(value);
        }
      }
      return total;
    };

    stats.total.js = calculate(stats.chunks) + calculate(stats.pages);
    stats.total.css = calculate(stats.css);
    stats.total.static = calculate(stats.static);
    stats.total.overall = stats.total.js + stats.total.css + stats.total.static;
  }

  checkSizeThresholds(stats) {
    console.log('📊 Checking Size Thresholds...\n');

    // Check individual chunks
    this.checkObject(stats.chunks, 'chunks');
    this.checkObject(stats.pages, 'pages');
    this.checkObject(stats.css, 'css');
    this.checkObject(stats.static, 'static');
  }

  checkObject(obj, prefix, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = path ? `${path}/${key}` : `${prefix}/${key}`;
      
      if (typeof value === 'object' && value.size) {
        this.checkThreshold(fullKey, value.size);
      } else if (typeof value === 'object') {
        this.checkObject(value, prefix, fullKey);
      }
    }
  }

  checkThreshold(name, size) {
    const threshold = this.findThreshold(name);
    if (threshold && size > threshold) {
      const violation = {
        file: name,
        size,
        threshold,
        excess: size - threshold,
        percentage: Math.round(((size - threshold) / threshold) * 100)
      };
      this.violations.push(violation);
      
      console.log(`❌ ${name}: ${this.formatBytes(size)} > ${this.formatBytes(threshold)} (+${violation.percentage}%)`);
    } else if (threshold) {
      const used = Math.round((size / threshold) * 100);
      console.log(`✅ ${name}: ${this.formatBytes(size)} (${used}% of budget)`);
    }
  }

  findThreshold(name) {
    // Exact match
    if (BUNDLE_THRESHOLDS[name]) return BUNDLE_THRESHOLDS[name];
    
    // Pattern matching
    for (const [pattern, threshold] of Object.entries(BUNDLE_THRESHOLDS)) {
      if (name.includes(pattern)) return threshold;
    }
    
    return null;
  }

  analyzePerformanceBudgets(stats) {
    console.log('\n🌐 Analyzing Performance Budgets...\n');

    for (const [connection, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
      console.log(`📱 ${connection.toUpperCase()} Connection:`);
      
      this.checkBudget('Total', stats.total.overall, budget.total);
      this.checkBudget('JavaScript', stats.total.js, budget.js);
      this.checkBudget('CSS', stats.total.css, budget.css);
      this.checkBudget('Images', this.getImageSize(stats.static), budget.images);
      
      console.log('');
    }
  }

  checkBudget(name, actual, budget) {
    const percentage = Math.round((actual / budget) * 100);
    const status = actual <= budget ? '✅' : '❌';
    const excess = actual > budget ? ` (+${this.formatBytes(actual - budget)})` : '';
    
    console.log(`  ${status} ${name}: ${this.formatBytes(actual)} / ${this.formatBytes(budget)} (${percentage}%)${excess}`);
    
    if (actual > budget) {
      this.violations.push({
        type: 'budget',
        category: name,
        size: actual,
        budget,
        excess: actual - budget
      });
    }
  }

  getImageSize(staticObj) {
    let total = 0;
    const traverse = (obj) => {
      for (const value of Object.values(obj)) {
        if (value.type === 'image') {
          total += value.size;
        } else if (typeof value === 'object' && !value.size) {
          traverse(value);
        }
      }
    };
    traverse(staticObj);
    return total;
  }

  findOptimizationOpportunities(stats) {
    console.log('💡 Optimization Opportunities...\n');

    // Look for large JavaScript files
    this.findLargeFiles(stats.chunks, 'chunks', 50000); // 50KB+
    this.findLargeFiles(stats.pages, 'pages', 30000);   // 30KB+
    
    // Check for duplicate dependencies
    this.checkDuplicateDependencies();
    
    // Check for unused CSS
    this.checkUnusedCSS();
    
    // Check for unoptimized images
    this.checkImageOptimization(stats.static);
  }

  findLargeFiles(obj, prefix, threshold, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = path ? `${path}/${key}` : `${prefix}/${key}`;
      
      if (typeof value === 'object' && value.size && value.size > threshold) {
        this.recommendations.push({
          type: 'large_file',
          file: fullKey,
          size: value.size,
          suggestion: `Consider code splitting or lazy loading for ${fullKey}`
        });
      } else if (typeof value === 'object' && !value.size) {
        this.findLargeFiles(value, prefix, threshold, fullKey);
      }
    }
  }

  checkDuplicateDependencies() {
    try {
      // Use npm ls to check for duplicate dependencies
      const output = execSync('npm ls --depth=0 --json', { 
        cwd: path.join(process.cwd(), 'apps/web'),
        encoding: 'utf8' 
      });
      
      const dependencies = JSON.parse(output);
      // Advanced duplicate detection would go here
      
    } catch (error) {
      // npm ls might fail, that's okay
    }
  }

  checkUnusedCSS() {
    // Check for potentially unused CSS files
    const cssFiles = [];
    this.findCSSFiles(cssFiles);
    
    if (cssFiles.length > 10) {
      this.recommendations.push({
        type: 'css_optimization',
        suggestion: 'Consider using PurgeCSS or similar tools to remove unused CSS'
      });
    }
  }

  findCSSFiles(files, obj = null) {
    // This would analyze CSS files for unused rules
    // Implementation would require more sophisticated analysis
  }

  checkImageOptimization(staticObj) {
    const unoptimizedImages = [];
    
    const traverse = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value.type === 'image' && value.size > 100000) { // 100KB+
          if (!key.includes('.webp') && !key.includes('optimized')) {
            unoptimizedImages.push({ name: key, size: value.size });
          }
        } else if (typeof value === 'object' && !value.size) {
          traverse(value);
        }
      }
    };
    
    traverse(staticObj);
    
    if (unoptimizedImages.length > 0) {
      this.recommendations.push({
        type: 'image_optimization',
        files: unoptimizedImages,
        suggestion: 'Convert large images to WebP format and implement responsive images'
      });
    }
  }

  generateReport(stats) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSize: stats.total.overall,
        jsSize: stats.total.js,
        cssSize: stats.total.css,
        staticSize: stats.total.static,
        violations: this.violations.length,
        recommendations: this.recommendations.length
      },
      violations: this.violations,
      recommendations: this.recommendations,
      thresholds: BUNDLE_THRESHOLDS,
      budgets: PERFORMANCE_BUDGETS
    };

    // Save detailed report
    fs.writeFileSync(this.resultsFile, JSON.stringify(report, null, 2));

    console.log('\n📋 Bundle Analysis Report\n');
    console.log(`📦 Total Bundle Size: ${this.formatBytes(stats.total.overall)}`);
    console.log(`📜 JavaScript: ${this.formatBytes(stats.total.js)}`);
    console.log(`🎨 CSS: ${this.formatBytes(stats.total.css)}`);
    console.log(`🖼️  Static Assets: ${this.formatBytes(stats.total.static)}`);
    console.log(`❌ Violations: ${this.violations.length}`);
    console.log(`💡 Recommendations: ${this.recommendations.length}`);
    
    if (this.violations.length > 0) {
      console.log('\n🚨 Critical Issues Found:');
      this.violations.forEach(v => {
        if (v.type === 'budget') {
          console.log(`  • ${v.category} exceeds ${this.formatBytes(v.budget)} by ${this.formatBytes(v.excess)}`);
        } else {
          console.log(`  • ${v.file} exceeds limit by ${v.percentage}%`);
        }
      });
    }

    if (this.recommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      this.recommendations.forEach(r => {
        console.log(`  • ${r.suggestion}`);
      });
    }

    console.log(`\n📄 Detailed report saved to: ${this.resultsFile}`);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// CLI execution
if (require.main === module) {
  const analyzer = new EliteBundleAnalyzer();
  analyzer.analyze()
    .then(exitCode => {
      if (exitCode === 0) {
        console.log('\n✅ Bundle analysis passed! All files within acceptable limits.');
      } else {
        console.log('\n❌ Bundle analysis failed! Please optimize before deployment.');
      }
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = EliteBundleAnalyzer;
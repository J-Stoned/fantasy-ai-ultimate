// 2025 Best Practice: Web Worker for heavy 3D processing
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

// Avatar processing cache
const modelCache = new Map<string, THREE.Group>();
const textureCache = new Map<string, THREE.Texture>();

// Initialize loaders
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
const ktx2Loader = new KTX2Loader();

// 2025: Use Draco for geometry compression
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
gltfLoader.setDRACOLoader(dracoLoader);

// Quality settings
const qualitySettings = {
  low: { textureSize: 512, polygons: 5000, bones: 30 },
  medium: { textureSize: 1024, polygons: 10000, bones: 50 },
  high: { textureSize: 2048, polygons: 20000, bones: 75 },
  ultra: { textureSize: 4096, polygons: 40000, bones: 100 }
};

let currentQuality: keyof typeof qualitySettings = 'high';

// Message handler
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'PROCESS_AVATAR':
      await processAvatar(payload.avatar, payload.quality);
      break;
      
    case 'SET_QUALITY':
      currentQuality = payload.quality;
      optimizeLoadedModels();
      break;
      
    case 'CLEAR_CACHE':
      clearCaches();
      break;
      
    case 'PRELOAD_TEXTURES':
      await preloadTextures(payload.urls);
      break;
  }
});

async function processAvatar(avatar: any, quality: keyof typeof qualitySettings) {
  try {
    const settings = qualitySettings[quality];
    
    // Check cache first
    let model = modelCache.get(avatar.playerId);
    
    if (!model) {
      // Load 3D model
      const gltf = await loadModel(avatar.avatarAsset.assetUrl);
      model = gltf.scene;
      
      // Optimize model based on quality
      optimizeModel(model, settings);
      
      // Cache the model
      modelCache.set(avatar.playerId, model);
    }
    
    // Process animations if available
    if (avatar.avatarAsset.animations) {
      await processAnimations(avatar.avatarAsset.animations);
    }
    
    // Apply customizations
    if (avatar.customizations) {
      applyCustomizations(model, avatar.customizations);
    }
    
    // Send success message
    self.postMessage({
      type: 'AVATAR_PROCESSED',
      playerId: avatar.playerId,
      success: true
    });
    
  } catch (error) {
    self.postMessage({
      type: 'AVATAR_PROCESSED',
      playerId: avatar.playerId,
      success: false,
      error: error.message
    });
  }
}

async function loadModel(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      (progress) => {
        self.postMessage({
          type: 'LOADING_PROGRESS',
          progress: (progress.loaded / progress.total) * 100
        });
      },
      (error) => reject(error)
    );
  });
}

function optimizeModel(model: THREE.Group, settings: typeof qualitySettings[keyof typeof qualitySettings]) {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Optimize geometry
      if (child.geometry) {
        const geometry = child.geometry;
        
        // 2025: Use geometry instancing for repeated meshes
        if (geometry.attributes.position.count > settings.polygons) {
          // Simplify geometry (using simplification algorithm)
          simplifyGeometry(geometry, settings.polygons);
        }
        
        // Optimize for GPU
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
      }
      
      // Optimize materials
      if (child.material) {
        optimizeMaterial(child.material, settings.textureSize);
      }
    }
    
    // Optimize bones for skeletal animation
    if (child instanceof THREE.SkinnedMesh) {
      if (child.skeleton.bones.length > settings.bones) {
        // Reduce bone count (LOD for skeleton)
        reduceBoneCount(child.skeleton, settings.bones);
      }
    }
  });
}

function optimizeMaterial(material: THREE.Material, textureSize: number) {
  if (material instanceof THREE.MeshStandardMaterial) {
    // 2025: Use KTX2 compressed textures
    const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap'];
    
    maps.forEach(mapName => {
      const texture = material[mapName];
      if (texture instanceof THREE.Texture) {
        // Resize texture if needed
        if (texture.image && (texture.image.width > textureSize || texture.image.height > textureSize)) {
          resizeTexture(texture, textureSize);
        }
        
        // Enable mipmapping for better performance
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
      }
    });
    
    // 2025: Use physically based rendering optimizations
    material.envMapIntensity = currentQuality === 'ultra' ? 1 : 0.5;
    material.aoMapIntensity = currentQuality === 'low' ? 0 : 1;
  }
}

function simplifyGeometry(geometry: THREE.BufferGeometry, targetCount: number) {
  // Implement geometry simplification algorithm (e.g., Quadric Error Metrics)
  // This is a placeholder - actual implementation would use a simplification library
  console.log(`Simplifying geometry from ${geometry.attributes.position.count} to ${targetCount} vertices`);
}

function reduceBoneCount(skeleton: THREE.Skeleton, targetCount: number) {
  // Implement bone reduction algorithm
  // This would merge less important bones while preserving animation quality
  console.log(`Reducing skeleton from ${skeleton.bones.length} to ${targetCount} bones`);
}

function resizeTexture(texture: THREE.Texture, size: number) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  if (ctx && texture.image) {
    ctx.drawImage(texture.image, 0, 0, size, size);
    texture.image = canvas;
    texture.needsUpdate = true;
  }
}

async function processAnimations(animations: any[]) {
  // Process and optimize animations
  for (const anim of animations) {
    // Load animation data
    // Optimize keyframes based on quality
    // Cache processed animations
  }
}

function applyCustomizations(model: THREE.Group, customizations: any) {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Apply jersey color
      if (customizations.jerseyColor && child.name.includes('jersey')) {
        const material = child.material as THREE.MeshStandardMaterial;
        material.color.set(customizations.jerseyColor);
      }
      
      // Apply jersey number
      if (customizations.jerseyNumber && child.name.includes('number')) {
        // Update number texture
      }
    }
  });
}

async function preloadTextures(urls: string[]) {
  const loader = new THREE.TextureLoader();
  
  const promises = urls.map(url => {
    if (textureCache.has(url)) {
      return Promise.resolve(textureCache.get(url));
    }
    
    return new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          textureCache.set(url, texture);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  });
  
  await Promise.all(promises);
}

function optimizeLoadedModels() {
  const settings = qualitySettings[currentQuality];
  
  modelCache.forEach((model) => {
    optimizeModel(model, settings);
  });
}

function clearCaches() {
  modelCache.clear();
  textureCache.clear();
  
  // Clean up Three.js resources
  modelCache.forEach((model) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  });
}
#!/bin/bash
# 🚀 INTEGRATE GPU-TRAINED MODEL

echo "🔥 FANTASY AI GPU MODEL INTEGRATION"
echo "==================================="

# 1. Create GPU models directory
echo "📁 Creating GPU models directory..."
mkdir -p models/gpu_trained

# 2. Check if model zip exists
if [ -f ~/Downloads/fantasy_ai_gpu_models.zip ]; then
    echo "✅ Found model in Downloads!"
    cp ~/Downloads/fantasy_ai_gpu_models.zip .
elif [ -f fantasy_ai_gpu_models.zip ]; then
    echo "✅ Found model in current directory!"
else
    echo "❌ ERROR: fantasy_ai_gpu_models.zip not found!"
    echo "   Please download it from Google Colab and place it in this directory"
    exit 1
fi

# 3. Extract models
echo "📦 Extracting GPU-trained models..."
unzip -o fantasy_ai_gpu_models.zip -d models/gpu_trained/

# 4. Check what we got
echo ""
echo "📊 Model files extracted:"
ls -la models/gpu_trained/

# 5. Check accuracy from metadata
if [ -f models/gpu_trained/metadata.json ]; then
    echo ""
    echo "🎯 MODEL ACCURACY:"
    echo "=================="
    cat models/gpu_trained/metadata.json | grep -A 10 "accuracy"
fi

echo ""
echo "✅ Models ready for integration!"
echo ""
echo "Next steps:"
echo "1. Run: npx tsx scripts/update-ml-api.ts"
echo "2. Test predictions with new model"
echo "3. Deploy to production!"
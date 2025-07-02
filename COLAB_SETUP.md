# 🚀 GOOGLE COLAB GPU TRAINING - QUICK SETUP

## 1. Open Google Colab
Go to: https://colab.research.google.com

## 2. Upload the Notebook
- Click "File" → "Upload notebook"
- Upload: `fantasy_ai_gpu_training.ipynb`

## 3. Enable GPU
- Click "Runtime" → "Change runtime type"
- Select "GPU" → "T4 GPU"
- Click "Save"

## 4. Update Credentials (Cell 2)
Replace these lines:
```python
SUPABASE_URL = "https://pvekvqiqrrpugfmpgaup.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE"
```

## 5. Run All Cells
- Click "Runtime" → "Run all"
- OR press Ctrl+F9

## 6. Watch the Magic! 🔥
The notebook will:
- Load 47,843 games
- Load player stats, injuries, weather, sentiment
- Engineer 36+ advanced features
- Train Neural Network with GPU
- Train XGBoost with GPU
- Create ensemble model
- Target: 75%+ accuracy!

## 7. Download Results
At the end, download `fantasy_ai_gpu_models.zip`

## Expected Timeline
- Setup: 2 minutes
- Data loading: 3-5 minutes
- Training: 10-15 minutes
- Total: ~20 minutes to 75%+ accuracy!

## Troubleshooting
- If GPU not available: Runtime → Change runtime type → GPU
- If connection lost: Runtime → Reconnect
- If out of memory: Runtime → Restart runtime

LET'S GET THAT 75%+ ACCURACY! 🚀🔥
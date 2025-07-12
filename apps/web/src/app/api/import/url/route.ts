import { NextRequest, NextResponse } from 'next/server'
import { UniversalUrlImporter } from '@/lib/import/universal-url-importer'
import { auth } from '@clerk/nextjs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { url } = await request.json()
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid URL provided' },
        { status: 400 }
      )
    }

    // Use the universal importer
    const result = await UniversalUrlImporter.importFromUrl(url, userId)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('URL import error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}
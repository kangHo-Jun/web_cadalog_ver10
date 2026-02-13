import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/sync-products`);
    const data = await response.json();
    
    return NextResponse.json({ 
      cron: 'success', 
      ...data 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      cron: 'failed', 
      error: error.message 
    }, { status: 500 });
  }
}

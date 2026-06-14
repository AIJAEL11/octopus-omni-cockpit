import { NextResponse } from 'next/server';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function optionsResponse() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export function jsonWithCors(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { ...init, headers: corsHeaders });
}
